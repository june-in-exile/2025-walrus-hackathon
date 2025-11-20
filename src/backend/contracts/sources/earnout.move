module contracts::earnout {
    use sui::event;
    use sui::clock::{Self, Clock};
    use std::string::{String};
    use sui::ed25519;
    use contracts::whitelist::{Self, Whitelist, Cap as WhitelistCap};

    // --- Error Codes ---

    const ENotBuyer: u64 = 0;
    const ENotAuditor: u64 = 1;
    const EInvalidSignature: u64 = 2;
    const EAlreadyAudited: u64 = 3;
    const ENotAuthorized: u64 = 4;
    const EDataIdNotFound: u64 = 5;
    const ESignatureMismatch: u64 = 6;
    const EPeriodNotFullyAudited: u64 = 7;
    const EInvalidAttestation: u64 = 8;
    const EKPIResultAlreadySubmitted: u64 = 9;
    const EPeriodNotFound: u64 = 10;
    const EAlreadySettled: u64 = 11;
    const ENoKPIResult: u64 = 12;

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
        kpi_result: Option<KPIResult>,      // Nautilus TEE calculation result
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

    // KPI Calculation Result (from Nautilus TEE)
    public struct KPIResult has store, copy, drop {
        period_id: String,
        kpi_type: String,             // e.g., "revenue", "ebitda"
        value: u64,                   // Calculation result (in smallest unit)
        attestation: vector<u8>,      // Nautilus TEE attestation
        computed_at: u64,             // Computation timestamp
    }

    // Data Audit Record Object
    public struct DataAuditRecord has key, store {
        id: UID,
        data_id: String,              // Walrus blob ID
        deal_id: ID,                  // Parent Deal
        period_id: String,            // Parent Period ID
        uploader: address,            // Uploader address
        upload_timestamp: u64,        // Upload timestamp
        audited: bool,                // Audit status (default false)
        auditor: Option<address>,     // Auditor address
        audit_timestamp: Option<u64>, // Audit timestamp
    }

    // --- Events ---

    public struct DealCreated has copy, drop { deal_id: ID, whitelist_id: ID, buyer: address }
    public struct BlobAdded has copy, drop { deal_id: ID, period_id: String, blob_id: String }
    public struct KPIProposed has copy, drop { deal_id: ID, period_id: String, value: u64 }
    public struct KPIAttested has copy, drop { deal_id: ID, period_id: String, approved: bool }

    // KPI Result Event
    public struct KPIResultSubmitted has copy, drop {
        deal_id: ID,
        period_id: String,
        kpi_value: u64,
        timestamp: u64,
    }

    // Data Audit Events
    public struct DataAuditRecordCreated has copy, drop {
        audit_record_id: ID,
        deal_id: ID,
        period_id: String,
        data_id: String,
        uploader: address
    }

    public struct DataAudited has copy, drop {
        audit_record_id: ID,
        deal_id: ID,
        period_id: String,
        data_id: String,
        auditor: address,
        timestamp: u64,
    }

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
            kpi_result: option::none(),
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

        let timestamp = clock::timestamp_ms(clock);

        let blob_ref = WalrusBlobRef {
            blob_id: blob_id,
            data_type,
            uploaded_at: timestamp,
            uploader: sender,
        };

        vector::push_back(&mut period.walrus_blobs, blob_ref);

        event::emit(BlobAdded {
            deal_id: deal_id, // 使用上面預先儲存的 ID
            period_id: period_id_copy,
            blob_id
        });

        // Create DataAuditRecord for this blob
        create_audit_record_internal(
            deal_id,
            period_id_copy,
            blob_id,
            sender,
            timestamp,
            ctx
        );
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

        let timestamp = clock::timestamp_ms(clock);
        let mut i = 0;
        let len = vector::length(&blob_ids);

        while (i < len) {
            let blob_id = *vector::borrow(&blob_ids, i);
            let data_type = *vector::borrow(&data_types, i);

            let blob_ref = WalrusBlobRef {
                blob_id: blob_id,
                data_type: data_type,
                uploaded_at: timestamp,
                uploader: sender,
            };

            vector::push_back(&mut period.walrus_blobs, blob_ref);

            // 發出事件
            event::emit(BlobAdded {
                deal_id: deal_id,
                period_id: period_id_copy,
                blob_id: blob_id
            });

            // Create DataAuditRecord for each blob
            create_audit_record_internal(
                deal_id,
                period_id_copy,
                blob_id,
                sender,
                timestamp,
                ctx
            );

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

    // --- Data Audit Functions ---

    /// Internal function to create audit record when blob is uploaded
    fun create_audit_record_internal(
        deal_id: ID,
        period_id: String,
        data_id: String,
        uploader: address,
        upload_timestamp: u64,
        ctx: &mut TxContext
    ) {
        let audit_record = DataAuditRecord {
            id: object::new(ctx),
            data_id,
            deal_id,
            period_id,
            uploader,
            upload_timestamp,
            audited: false,
            auditor: option::none(),
            audit_timestamp: option::none(),
        };

        let audit_record_id = object::id(&audit_record);

        event::emit(DataAuditRecordCreated {
            audit_record_id,
            deal_id,
            period_id,
            data_id,
            uploader
        });

        transfer::share_object(audit_record);
    }

    /// Auditor audits a data record with signature verification
    public fun audit_data(
        deal: &Deal,
        audit_record: &mut DataAuditRecord,
        signature: vector<u8>,
        public_key: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);

        // Check if caller is the auditor
        assert!(sender == deal.auditor, ENotAuditor);

        // Check if already audited
        assert!(!audit_record.audited, EAlreadyAudited);

        // Check if audit_record belongs to this deal
        assert!(audit_record.deal_id == object::id(deal), ENotAuthorized);

        // Build the message that should have been signed: "AUDIT:{data_id}"
        let mut message = vector::empty<u8>();
        vector::append(&mut message, b"AUDIT:");
        vector::append(&mut message, *audit_record.data_id.as_bytes());

        // Verify ed25519 signature
        let is_valid = ed25519::ed25519_verify(&signature, &public_key, &message);
        assert!(is_valid, EInvalidSignature);

        // Update audit record
        let timestamp = clock::timestamp_ms(clock);
        audit_record.audited = true;
        audit_record.auditor = option::some(sender);
        audit_record.audit_timestamp = option::some(timestamp);

        // Emit event
        event::emit(DataAudited {
            audit_record_id: object::id(audit_record),
            deal_id: audit_record.deal_id,
            period_id: audit_record.period_id,
            data_id: audit_record.data_id,
            auditor: sender,
            timestamp,
        });
    }

    /// Check if all data in a period has been audited
    /// Returns (total_count, audited_count, is_ready)
    /// Note: This is a view function that can be called from frontend
    /// Frontend needs to query all DataAuditRecord objects for the deal/period first
    public fun check_period_audit_status(
        deal_id: ID,
        period_id: String,
        audit_records: &vector<DataAuditRecord>
    ): (u64, u64, bool) {
        let mut total_count = 0;
        let mut audited_count = 0;

        let len = vector::length(audit_records);
        let mut i = 0;

        while (i < len) {
            let record = vector::borrow(audit_records, i);

            // Only count records for this deal and period
            if (record.deal_id == deal_id && record.period_id == period_id) {
                total_count = total_count + 1;
                if (record.audited) {
                    audited_count = audited_count + 1;
                };
            };

            i = i + 1;
        };

        let is_ready = (total_count > 0 && total_count == audited_count);
        (total_count, audited_count, is_ready)
    }

    // --- Accessor Functions for DataAuditRecord ---

    public fun audit_record_is_audited(record: &DataAuditRecord): bool {
        record.audited
    }

    public fun audit_record_data_id(record: &DataAuditRecord): String {
        record.data_id
    }

    public fun audit_record_deal_id(record: &DataAuditRecord): ID {
        record.deal_id
    }

    public fun audit_record_period_id(record: &DataAuditRecord): String {
        record.period_id
    }

    public fun audit_record_uploader(record: &DataAuditRecord): address {
        record.uploader
    }

    public fun audit_record_upload_timestamp(record: &DataAuditRecord): u64 {
        record.upload_timestamp
    }

    public fun audit_record_auditor(record: &DataAuditRecord): Option<address> {
        record.auditor
    }

    public fun audit_record_audit_timestamp(record: &DataAuditRecord): Option<u64> {
        record.audit_timestamp
    }

    // --- Nautilus TEE Integration Functions ---

    /// Verify Nautilus TEE attestation
    /// This is a simplified version - production should verify actual TEE signatures
    public fun verify_nautilus_attestation(
        attestation: &vector<u8>,
        _expected_period_id: &String,
        _expected_kpi_value: u64,
    ): bool {
        // In production, this should:
        // 1. Parse attestation structure
        // 2. Verify enclave ID is in whitelist
        // 3. Verify TEE signature
        // 4. Verify output hash matches expected values

        // For now, we do basic length validation
        // A real attestation should be at least 32 bytes (signature)
        let attestation_length = vector::length(attestation);

        // Basic validation: attestation should not be empty
        if (attestation_length == 0) {
            return false
        };

        // TODO: Implement actual TEE attestation verification
        // - Parse attestation bytes
        // - Extract and verify enclave ID
        // - Verify cryptographic signature
        // - Validate output hash

        true // Placeholder - accept all non-empty attestations for now
    }

    /// Submit KPI result calculated by Nautilus TEE
    /// Can only be called by Buyer or system account
    /// Requires all data in the period to be audited first
    public fun submit_kpi_result(
        deal: &mut Deal,
        period_index: u64,
        kpi_type: String,
        kpi_value: u64,
        attestation: vector<u8>,
        audit_records: &vector<DataAuditRecord>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Only buyer can submit KPI result
        let sender = tx_context::sender(ctx);
        assert!(sender == deal.buyer, ENotBuyer);

        // Get deal_id early before borrowing
        let deal_id = object::id(deal);

        // Get the period
        let periods_len = vector::length(&deal.periods);
        assert!(period_index < periods_len, EPeriodNotFound);
        let period = vector::borrow_mut(&mut deal.periods, period_index);

        // Check if KPI result already submitted
        assert!(option::is_none(&period.kpi_result), EKPIResultAlreadySubmitted);

        // Verify all data in period is audited
        let (total_count, _audited_count, is_ready) = check_period_audit_status(
            deal_id,
            period.id,
            audit_records
        );
        assert!(is_ready && total_count > 0, EPeriodNotFullyAudited);

        // Verify Nautilus attestation
        let is_valid = verify_nautilus_attestation(
            &attestation,
            &period.id,
            kpi_value
        );
        assert!(is_valid, EInvalidAttestation);

        // Create and store KPI result
        let timestamp = clock::timestamp_ms(clock);
        let kpi_result = KPIResult {
            period_id: period.id,
            kpi_type,
            value: kpi_value,
            attestation,
            computed_at: timestamp,
        };
        period.kpi_result = option::some(kpi_result);

        // Emit event
        event::emit(KPIResultSubmitted {
            deal_id,
            period_id: period.id,
            kpi_value,
            timestamp,
        });
    }

    // --- Accessor Functions for KPIResult ---

    public fun kpi_result_period_id(result: &KPIResult): String {
        result.period_id
    }

    public fun kpi_result_kpi_type(result: &KPIResult): String {
        result.kpi_type
    }

    public fun kpi_result_value(result: &KPIResult): u64 {
        result.value
    }

    public fun kpi_result_attestation(result: &KPIResult): vector<u8> {
        result.attestation
    }

    public fun kpi_result_computed_at(result: &KPIResult): u64 {
        result.computed_at
    }

    // --- Settlement Functions ---

    /// Execute earn-out settlement for a period
    /// Requires:
    /// 1. All data in period must be audited
    /// 2. Valid KPI result must be submitted with attestation
    /// 3. Only buyer can trigger settlement
    /// 4. Period must not be already settled
    public fun settle(
        deal: &mut Deal,
        period_index: u64,
        audit_records: &vector<DataAuditRecord>,
        ctx: &mut TxContext
    ) {
        // Only buyer can trigger settlement
        let sender = tx_context::sender(ctx);
        assert!(sender == deal.buyer, ENotBuyer);

        // Get deal_id early before borrowing
        let deal_id = object::id(deal);

        // Get the period
        let periods_len = vector::length(&deal.periods);
        assert!(period_index < periods_len, EPeriodNotFound);
        let period = vector::borrow_mut(&mut deal.periods, period_index);

        // Check if period is already settled
        assert!(!period.is_settled, EAlreadySettled);

        // Verify all data in period is audited
        let (total_count, _audited_count, is_ready) = check_period_audit_status(
            deal_id,
            period.id,
            audit_records
        );
        assert!(is_ready && total_count > 0, EPeriodNotFullyAudited);

        // Verify KPI result exists
        assert!(option::is_some(&period.kpi_result), ENoKPIResult);

        // Mark period as settled
        period.is_settled = true;

        // TODO: In production, implement actual token transfer logic here
        // For example:
        // - Calculate earn-out amount based on KPI value
        // - Transfer tokens from escrow to seller
        // - Emit settlement event with transfer details

        // Emit settlement event (not yet defined in events)
        // event::emit(PeriodSettled {
        //     deal_id,
        //     period_id: period.id,
        //     kpi_value: kpi_result_value(&option::borrow(&period.kpi_result)),
        //     timestamp: clock::timestamp_ms(clock),
        // });
    }
}