module contracts::earnout {
    use sui::event;
    use sui::clock::{Self, Clock};
    use std::string::{String};
    use contracts::whitelist::{Self, Whitelist, Cap as WhitelistCap};

    // --- Error Codes ---

    const ENotBuyer: u64 = 0;
    const ENotAuditor: u64 = 1;
    const ENotAuthorized: u64 = 4;

    // --- Structs ---

    public struct Deal has key, store {
        id: UID,
        name: String,
        buyer: address,
        seller: address,
        auditor: address,
        periods: vector<Period>,
        parameters_locked: bool,
        whitelist_id: ID,
        whitelist_cap: WhitelistCap,
    }

    public struct Period has store {
        id: String,
        walrus_blobs: vector<WalrusBlobRef>,
        kpi_proposal: Option<KPIProposal>,
        kpi_attestation: Option<KPIAttestation>,
        is_settled: bool,
    }

    public struct WalrusBlobRef has store, copy, drop {
        blob_id: String,
        data_type: String,
        uploaded_at: u64,
        uploader: address,
    }

    public struct KPIProposal has store, copy, drop {
        value: u64,
        proposed_at: u64,
        notes: String,
    }

    public struct KPIAttestation has store, copy, drop {
        value: u64,
        attested_at: u64,
        is_approved: bool,
        notes: String,
    }

    // --- Events ---

    public struct DealCreated has copy, drop { deal_id: ID, whitelist_id: ID, buyer: address }
    public struct BlobAdded has copy, drop { deal_id: ID, period_id: String, blob_id: String }
    public struct KPIProposed has copy, drop { deal_id: ID, period_id: String, value: u64 }
    public struct KPIAttested has copy, drop { deal_id: ID, period_id: String, approved: bool }

    // --- Functions ---

    /**
    Sui Integration:

    Writes: Creates new Deal object via earnout::create_deal()
    Transaction: Returns unsigned transaction for frontend to sign
    Events: Emits DealCreated event on-chain with dealId
    Gas: Estimated ~1,000,000 MIST
    */
    public fun create_deal(
        name: String,
        seller: address,
        auditor: address,
        ctx: &mut TxContext
    ) {
        let buyer = tx_context::sender(ctx);

        // 1. Create Whitelist
        let (wl_cap,mut wl) = whitelist::create_whitelist(ctx);
        let wl_id = object::id(&wl);

        // 2. Add members
        whitelist::add(&mut wl, &wl_cap, buyer);
        whitelist::add(&mut wl, &wl_cap, seller);
        whitelist::add(&mut wl, &wl_cap, auditor);

        // 3. Share Whitelist
        whitelist::share_whitelist(wl);

        // 4. Create Deal
        let deal = Deal {
            id: object::new(ctx),
            name,
            buyer,
            seller,
            auditor,
            periods: vector::empty(),
            parameters_locked: false,
            whitelist_id: wl_id,
            whitelist_cap: wl_cap,
        };
        
        event::emit(DealCreated { 
            deal_id: object::id(&deal), 
            whitelist_id: wl_id,
            buyer 
        });

        transfer::share_object(deal);
    }

    public fun add_period(
        deal: &mut Deal,
        period_id: String,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == deal.buyer, ENotBuyer);
        assert!(!deal.parameters_locked, 3);

        let period = Period {
            id: period_id,
            walrus_blobs: vector::empty(),
            kpi_proposal: option::none(),
            kpi_attestation: option::none(),
            is_settled: false,
        };
        vector::push_back(&mut deal.periods, period);
    }

    // // 保留單一新增功能，但更新為支援 formula 為空
    // public fun add_period(
    //     deal: &mut Deal,
    //     period_id: String,
    //     ctx: &mut TxContext
    // ) {
    //     assert!(tx_context::sender(ctx) == deal.buyer, ENotBuyer);
    //     assert!(!deal.parameters_locked, EParametersLocked);

    //     let period = Period {
    //         id: period_id,
    //         walrus_blobs: vector::empty(),
    //         formula: option::none(),
    //         kpi_proposal: option::none(),
    //         kpi_attestation: option::none(),
    //         is_settled: false,
    //         settled_amount: 0,
    //     };
    //     vector::push_back(&mut deal.periods, period);
    // }
    // /// 這會一次性寫入多個 Period 及其對應的 Formula，並鎖定合約
    // public fun set_parameters(
    //     deal: &mut Deal,
    //     period_ids: vector<String>,
    //     kpi_types: vector<String>,
    //     thresholds: vector<u64>,
    //     max_payouts: vector<u64>,
    //     ctx: &mut TxContext
    // ) {
    //     let sender = tx_context::sender(ctx);
    //     assert!(sender == deal.buyer, ENotBuyer);
    //     assert!(!deal.parameters_locked, EParametersLocked);

    //     let len = vector::length(&period_ids);
    //     assert!(vector::length(&kpi_types) == len, EMismatchLength);
    //     assert!(vector::length(&thresholds) == len, EMismatchLength);
    //     assert!(vector::length(&max_payouts) == len, EMismatchLength);

    //     // 批次建立 Periods
    //     let mut i = 0;
    //     while (i < len) {
    //         let formula = Formula {
    //             kpi_type: *vector::borrow(&kpi_types, i),
    //             kpi_threshold: *vector::borrow(&thresholds, i),
    //             max_payout: *vector::borrow(&max_payouts, i),
    //         };

    //         let period = Period {
    //             id: *vector::borrow(&period_ids, i),
    //             walrus_blobs: vector::empty(),
    //             formula: option::some(formula),
    //             kpi_proposal: option::none(),
    //             kpi_attestation: option::none(),
    //             is_settled: false,
    //             settled_amount: 0,
    //         };
            
    //         vector::push_back(&mut deal.periods, period);
    //         i = i + 1;
    //     };

    //     // 鎖定參數，之後不可再修改 Period 結構
    //     deal.parameters_locked = true;

    //     event::emit(ParametersLocked {
    //         deal_id: object::id(deal)
    //     });
    // }

    public fun add_walrus_blob(
        deal: &mut Deal,
        period_index: u64,
        blob_id: String,
        data_type: String,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(sender == deal.buyer, ENotBuyer);
        
        // [Fix]: 必須在 borrow_mut 之前先取得 deal_id，避免所有權衝突
        let deal_id = object::id(deal);

        let period = vector::borrow_mut(&mut deal.periods, period_index);
        let period_id_copy = period.id; // Copy for event
        
        let blob_ref = WalrusBlobRef {
            blob_id: blob_id,
            data_type,
            uploaded_at: clock::timestamp_ms(clock),
            uploader: sender,
        };

        vector::push_back(&mut period.walrus_blobs, blob_ref);

        event::emit(BlobAdded {
            deal_id: deal_id, // 使用上面預先儲存的 ID
            period_id: period_id_copy,
            blob_id
        });
    }

    public fun add_walrus_blobs_batch(
        deal: &mut Deal,
        period_index: u64,
        blob_ids: vector<String>,
        data_types: vector<String>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(sender == deal.buyer, ENotBuyer);
        
        // 檢查兩個向量長度是否一致
        assert!(vector::length(&blob_ids) == vector::length(&data_types), 0);

        // 先取得 Deal ID (避免迴圈內的 borrow 衝突)
        let deal_id = object::id(deal);
        let period = vector::borrow_mut(&mut deal.periods, period_index);
        let period_id_copy = period.id;

        let mut i = 0;
        let len = vector::length(&blob_ids);

        while (i < len) {
            let blob_id = *vector::borrow(&blob_ids, i);
            let data_type = *vector::borrow(&data_types, i);

            let blob_ref = WalrusBlobRef {
                blob_id: blob_id,
                data_type: data_type,
                uploaded_at: clock::timestamp_ms(clock),
                uploader: sender,
            };

            vector::push_back(&mut period.walrus_blobs, blob_ref);

            // 發出事件
            event::emit(BlobAdded {
                deal_id: deal_id,
                period_id: period_id_copy,
                blob_id: blob_id
            });

            i = i + 1;
        };
    }

    /**
    Sui Integration:

    Writes: Calls earnout::propose_kpi(deal, period, value)
    Transaction: Returns unsigned transaction for buyer to sign
    Events: Emits KPIProposed event with dealId, periodId, value
    State: Period.kpiProposal updated with proposed value
    Gas: Estimated ~1,500,000 MIST

    */
    public fun propose_kpi(
        deal: &mut Deal,
        period_index: u64,
        value: u64,
        notes: String,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(sender == deal.buyer, ENotBuyer);

        // [Fix]: 先取得 deal_id
        let deal_id = object::id(deal);

        let period = vector::borrow_mut(&mut deal.periods, period_index);
        let period_id_copy = period.id;

        let proposal = KPIProposal {
            value,
            proposed_at: clock::timestamp_ms(clock),
            notes
        };

        period.kpi_proposal = option::some(proposal);

        event::emit(KPIProposed {
            deal_id: deal_id,
            period_id: period_id_copy,
            value
        });
    }

    /**
    Sui Integration:

    Writes: Calls earnout::attest_kpi(deal, period, value, approved)
    Transaction: Returns unsigned transaction for auditor to sign
    Events: Emits KPIAttested event with final verified value
    State: Period.kpiAttestation updated, status → "attested"
    Gas: Estimated ~1,800,000 MIST
    */
    public fun attest_kpi(
        deal: &mut Deal,
        period_index: u64,
        verified_value: u64,
        approve: bool,
        notes: String,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(sender == deal.auditor, ENotAuditor);

        // [Fix]: 先取得 deal_id
        let deal_id = object::id(deal);

        let period = vector::borrow_mut(&mut deal.periods, period_index);
        let period_id_copy = period.id;
        
        let attestation = KPIAttestation {
            value: verified_value,
            attested_at: clock::timestamp_ms(clock),
            is_approved: approve,
            notes
        };

        period.kpi_attestation = option::some(attestation);
        
        event::emit(KPIAttested {
            deal_id: deal_id,
            period_id: period_id_copy,
            approved: approve
        });
    }

    public fun change_auditor(
        deal: &mut Deal,
        wl: &mut Whitelist, 
        new_auditor: address,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == deal.buyer, ENotAuthorized);
        assert!(object::id(wl) == deal.whitelist_id, ENotAuthorized);

        whitelist::remove(wl, &deal.whitelist_cap, deal.auditor);
        
        deal.auditor = new_auditor;

        whitelist::add(wl, &deal.whitelist_cap, new_auditor);
    }
}