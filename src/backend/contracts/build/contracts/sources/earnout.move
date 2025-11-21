module contracts::earnout {
    use sui::event;
    use sui::clock::{Self, Clock};
    use std::string::{String};
    use sui::ed25519;
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use contracts::whitelist::{Self, Whitelist, Cap as WhitelistCap};

    // --- Error Codes ---

    const ENotBuyer: u64 = 0;
    const ENotAuditor: u64 = 1;
    const EInvalidSignature: u64 = 2;
    const EAlreadyAudited: u64 = 3;
    const ENotAuthorized: u64 = 4;
    const EParametersLocked: u64 = 5;
    const EMismatchLength: u64 = 6;
    const EInvalidAttestation: u64 = 8;
    const EKPIResultAlreadySubmitted: u64 = 9;
    const ESubperiodNotFound: u64 = 10;
    const EAlreadySettled: u64 = 11;
    const EParametersNotSet: u64 = 12;
    const EInsufficientPayment: u64 = 14;


    // --- Structs ---

    /// Main Deal struct representing an M&A earn-out agreement
    ///
    /// Design: A Deal has ONE continuous earn-out period with cumulative KPI tracking.
    /// The period is divided into multiple subperiods for document organization.
    /// KPI values accumulate across subperiods, and settlement happens once at the end.
    public struct Deal has key, store {
        id: UID,
        name: String,
        buyer: address,
        seller: address,
        auditor: address,
        start_date: u64,              // Unix timestamp (ms) when earn-out begins

        // Single period parameters
        period_months: u64,           // Total earn-out duration in months
        kpi_threshold: u64,           // Cumulative KPI target to trigger payout
        max_payout: u64,              // Maximum earn-out payment amount

        // Subperiods for document organization
        subperiods: vector<Subperiod>,

        // Settlement state
        kpi_result: Option<KPIResult>,
        is_settled: bool,
        settled_amount: u64,

        // Access control
        parameters_locked: bool,
        whitelist_id: ID,
        whitelist_cap: WhitelistCap,
    }

    /// Subperiod for organizing documents within the earn-out period
    /// Each subperiod represents a time slice (e.g., a month or quarter)
    public struct Subperiod has store {
        id: String,                   // e.g., "2025-11", "2025-Q4"
        start_date: u64,              // Unix timestamp (ms)
        end_date: u64,                // Unix timestamp (ms)
        walrus_blobs: vector<WalrusBlobRef>,
    }

    public struct WalrusBlobRef has store, copy, drop {
        blob_id: String,
        data_type: String,
        uploaded_at: u64,
        uploader: address,
    }

    // KPI Calculation Result (from Nautilus TEE)
    // Represents the cumulative KPI value at settlement time
    public struct KPIResult has store, copy, drop {
        kpi_type: String,             // e.g., "net_profit", "revenue"
        value: u64,                   // Cumulative calculation result
        attestation: vector<u8>,      // Nautilus TEE attestation
        computed_at: u64,             // Computation timestamp
    }

    // Data Audit Record Object
    public struct DataAuditRecord has key, store {
        id: UID,
        data_id: String,              // Walrus blob ID
        deal_id: ID,                  // Parent Deal
        subperiod_id: String,         // Parent Subperiod ID
        uploader: address,            // Uploader address
        upload_timestamp: u64,        // Upload timestamp
        audited: bool,                // Audit status (default false)
        auditor: Option<address>,     // Auditor address
        audit_timestamp: Option<u64>, // Audit timestamp
    }

    // --- Events ---

    public struct DealCreated has copy, drop {
        deal_id: ID,
        whitelist_id: ID,
        buyer: address,
        start_date: u64
    }



    public struct BlobAdded has copy, drop {
        deal_id: ID,
        subperiod_id: String,
        blob_id: String
    }

    // KPI Result Event
    public struct KPIResultSubmitted has copy, drop {
        deal_id: ID,
        kpi_value: u64,
        timestamp: u64,
    }

    // Settlement Event
    public struct DealSettled has copy, drop {
        deal_id: ID,
        kpi_value: u64,
        kpi_met: bool,
        payout_amount: u64,
    }

    // Data Audit Events
    public struct DataAuditRecordCreated has copy, drop {
        audit_record_id: ID,
        deal_id: ID,
        subperiod_id: String,
        data_id: String,
        uploader: address
    }

    public struct DataAudited has copy, drop {
        audit_record_id: ID,
        deal_id: ID,
        subperiod_id: String,
        data_id: String,
        auditor: address,
        timestamp: u64,
    }

    // --- Functions ---

    /**
    Create a new earn-out deal.

    Sui Integration:
    - Creates new Deal object
    - Creates and shares Whitelist for Seal encryption access control
    - Emits DealCreated event
    */
    public fun create_deal(
        name: String,
        seller: address,
        auditor: address,
        start_date: u64,
        period_months: u64,
        kpi_threshold: u64,
        max_payout: u64,
        subperiod_ids: vector<String>,
        subperiod_start_dates: vector<u64>,
        subperiod_end_dates: vector<u64>,
        ctx: &mut TxContext
    ) {
        let buyer = tx_context::sender(ctx);

        // Assertions for new parameters
        let len = vector::length(&subperiod_ids);
        assert!(vector::length(&subperiod_start_dates) == len, EMismatchLength);
        assert!(vector::length(&subperiod_end_dates) == len, EMismatchLength);

        // 1. Create Whitelist for Seal access control
        let (wl_cap, mut wl) = whitelist::create_whitelist(ctx);
        let wl_id = object::id(&wl);

        // 2. Add all parties to whitelist
        whitelist::add(&mut wl, &wl_cap, buyer);
        whitelist::add(&mut wl, &wl_cap, seller);
        whitelist::add(&mut wl, &wl_cap, auditor);

        // 3. Share Whitelist
        whitelist::share_whitelist(wl);

        // 4. Create Deal with all parameters set and locked
        let mut deal = Deal {
            id: object::new(ctx),
            name,
            buyer,
            seller,
            auditor,
            start_date,
            period_months,
            kpi_threshold,
            max_payout,
            subperiods: vector::empty(),
            kpi_result: option::none(),
            is_settled: false,
            settled_amount: 0,
            parameters_locked: true,
            whitelist_id: wl_id,
            whitelist_cap: wl_cap,
        };

        let mut i = 0;
        while (i < len) {
            let subperiod = Subperiod {
                id: *vector::borrow(&subperiod_ids, i),
                start_date: *vector::borrow(&subperiod_start_dates, i),
                end_date: *vector::borrow(&subperiod_end_dates, i),
                walrus_blobs: vector::empty(),
            };
            vector::push_back(&mut deal.subperiods, subperiod);
            i = i + 1;
        };

        event::emit(DealCreated {
            deal_id: object::id(&deal),
            whitelist_id: wl_id,
            buyer,
            start_date,
        });

        transfer::share_object(deal);
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

    // --- Data Upload Functions ---

    /// Internal function to create audit record when blob is uploaded
    fun create_audit_record_internal(
        deal_id: ID,
        subperiod_id: String,
        data_id: String,
        uploader: address,
        upload_timestamp: u64,
        ctx: &mut TxContext
    ) {
        let audit_record = DataAuditRecord {
            id: object::new(ctx),
            data_id,
            deal_id,
            subperiod_id,
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
            subperiod_id,
            data_id,
            uploader
        });

        transfer::share_object(audit_record);
    }

    /// Add a Walrus blob reference to a subperiod
    ///
    /// Documents are organized by subperiod for easier tracking and auditing.
    /// The blob_id should be the Walrus blob ID after uploading encrypted data.
    public fun add_walrus_blob(
        deal: &mut Deal,
        subperiod_index: u64,
        blob_id: String,
        data_type: String,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(sender == deal.buyer, ENotBuyer);
        assert!(deal.parameters_locked, EParametersNotSet);

        let deal_id = object::id(deal);
        let subperiods_len = vector::length(&deal.subperiods);
        assert!(subperiod_index < subperiods_len, ESubperiodNotFound);

        let subperiod = vector::borrow_mut(&mut deal.subperiods, subperiod_index);
        let subperiod_id_copy = subperiod.id;

        let timestamp = clock::timestamp_ms(clock);

        let blob_ref = WalrusBlobRef {
            blob_id: blob_id,
            data_type,
            uploaded_at: timestamp,
            uploader: sender,
        };

        vector::push_back(&mut subperiod.walrus_blobs, blob_ref);

        event::emit(BlobAdded {
            deal_id,
            subperiod_id: subperiod_id_copy,
            blob_id
        });

        // Create DataAuditRecord for this blob
        create_audit_record_internal(
            deal_id,
            subperiod_id_copy,
            blob_id,
            sender,
            timestamp,
            ctx
        );
    }

    // --- Data Audit Functions ---

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

        assert!(sender == deal.auditor, ENotAuditor);
        assert!(!audit_record.audited, EAlreadyAudited);
        assert!(audit_record.deal_id == object::id(deal), ENotAuthorized);

        // Build the message: "AUDIT:{data_id}"
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

        event::emit(DataAudited {
            audit_record_id: object::id(audit_record),
            deal_id: audit_record.deal_id,
            subperiod_id: audit_record.subperiod_id,
            data_id: audit_record.data_id,
            auditor: sender,
            timestamp,
        });
    }

    /// Check audit status for a subperiod
    public fun check_subperiod_audit_status(
        deal_id: ID,
        subperiod_id: String,
        audit_records: &vector<DataAuditRecord>
    ): (u64, u64, bool) {
        let mut total_count = 0;
        let mut audited_count = 0;

        let len = vector::length(audit_records);
        let mut i = 0;

        while (i < len) {
            let record = vector::borrow(audit_records, i);
            if (record.deal_id == deal_id && record.subperiod_id == subperiod_id) {
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

    // --- Settlement Functions ---

    /// Verify Nautilus TEE attestation (simplified for now)
    public fun verify_nautilus_attestation(
        attestation: &vector<u8>,
        _expected_kpi_value: u64,
    ): bool {
        let attestation_length = vector::length(attestation);
        if (attestation_length == 0) {
            return false
        };
        // TODO: Implement actual TEE attestation verification
        true
    }

    /// Submit cumulative KPI result and execute settlement.
    ///
    /// This settles the entire deal based on cumulative KPI across all subperiods.
    /// Settlement can only happen once per deal.
    #[allow(lint(self_transfer))]
    public fun submit_kpi_and_settle(
        deal: &mut Deal,
        kpi_type: String,
        kpi_value: u64,
        attestation: vector<u8>,
        mut payment: Coin<SUI>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(sender == deal.buyer, ENotBuyer);
        assert!(deal.parameters_locked, EParametersNotSet);
        assert!(!deal.is_settled, EAlreadySettled);
        assert!(option::is_none(&deal.kpi_result), EKPIResultAlreadySubmitted);

        // Verify attestation
        let is_valid = verify_nautilus_attestation(&attestation, kpi_value);
        assert!(is_valid, EInvalidAttestation);

        let deal_id = object::id(deal);
        let seller = deal.seller;
        let timestamp = clock::timestamp_ms(clock);

        // Store KPI result
        let kpi_result = KPIResult {
            kpi_type,
            value: kpi_value,
            attestation,
            computed_at: timestamp,
        };
        deal.kpi_result = option::some(kpi_result);

        // Emit KPI submission event
        event::emit(KPIResultSubmitted {
            deal_id,
            kpi_value,
            timestamp,
        });

        // Calculate payout based on cumulative KPI
        let kpi_met = kpi_value >= deal.kpi_threshold;
        let payout_amount = if (kpi_met) {
            deal.max_payout
        } else {
            0
        };

        // Check payment is sufficient
        assert!(coin::value(&payment) >= payout_amount, EInsufficientPayment);

        // Execute settlement
        if (payout_amount > 0) {
            let payout_coin = coin::split(&mut payment, payout_amount, ctx);
            transfer::public_transfer(payout_coin, seller);
        };

        // Return remaining payment to buyer
        transfer::public_transfer(payment, sender);

        // Mark deal as settled
        deal.is_settled = true;
        deal.settled_amount = payout_amount;

        event::emit(DealSettled {
            deal_id,
            kpi_value,
            kpi_met,
            payout_amount,
        });
    }

    // --- Accessor Functions ---

    // Deal accessors
    public fun deal_start_date(deal: &Deal): u64 { deal.start_date }
    public fun deal_period_months(deal: &Deal): u64 { deal.period_months }
    public fun deal_kpi_threshold(deal: &Deal): u64 { deal.kpi_threshold }
    public fun deal_max_payout(deal: &Deal): u64 { deal.max_payout }
    public fun deal_is_settled(deal: &Deal): bool { deal.is_settled }
    public fun deal_settled_amount(deal: &Deal): u64 { deal.settled_amount }
    public fun deal_subperiod_count(deal: &Deal): u64 { vector::length(&deal.subperiods) }

    // DataAuditRecord accessors
    public fun audit_record_is_audited(record: &DataAuditRecord): bool { record.audited }
    public fun audit_record_data_id(record: &DataAuditRecord): String { record.data_id }
    public fun audit_record_deal_id(record: &DataAuditRecord): ID { record.deal_id }
    public fun audit_record_subperiod_id(record: &DataAuditRecord): String { record.subperiod_id }
    public fun audit_record_uploader(record: &DataAuditRecord): address { record.uploader }
    public fun audit_record_upload_timestamp(record: &DataAuditRecord): u64 { record.upload_timestamp }
    public fun audit_record_auditor(record: &DataAuditRecord): Option<address> { record.auditor }
    public fun audit_record_audit_timestamp(record: &DataAuditRecord): Option<u64> { record.audit_timestamp }

    // KPIResult accessors
    public fun kpi_result_kpi_type(result: &KPIResult): String { result.kpi_type }
    public fun kpi_result_value(result: &KPIResult): u64 { result.value }
    public fun kpi_result_attestation(result: &KPIResult): vector<u8> { result.attestation }
    public fun kpi_result_computed_at(result: &KPIResult): u64 { result.computed_at }
}
