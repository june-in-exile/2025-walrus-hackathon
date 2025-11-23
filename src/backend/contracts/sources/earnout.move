module contracts::earnout {
    use sui::event;
    use sui::clock::{Self, Clock};
    use std::string::{String};
    use sui::coin::Coin;
    use sui::sui::SUI;

    // --- Error Codes ---

    const ENotBuyer: u64 = 0;
    const ENotSeller: u64 = 1;
    const ENotAuditor: u64 = 2;
    const EAlreadyAudited: u64 = 3;
    const ENotAuthorized: u64 = 4;
    const EMismatchLength: u64 = 5;
    const EInvalidAttestation: u64 = 6;
    // const EKPIResultAlreadySubmitted: u64 = 7; // Removed: Allow resubmission until settled
    const ESubperiodNotFound: u64 = 8;
    const EAlreadySettled: u64 = 9;
    const EParametersNotSet: u64 = 10;
    // const EInsufficientPayment: u64 = 11; // Removed: No longer used in simplified settlement
    const ENoSealAccess: u64 = 12;

    // --- Structs ---

    /// Asset struct representing a fixed asset in the deal
    public struct Asset has store, copy, drop {
        asset_id: String,             // Asset identifier (e.g., "MACH-001A")
        useful_life_months: u64,      // Estimated useful life in months
    }

    /// Main Deal struct representing an M&A earn-out agreement
    ///
    /// Design: A Deal has ONE continuous earn-out period with cumulative KPI tracking.
    /// The period is divided into multiple subperiods for document organization.
    /// KPI values accumulate across subperiods, and settlement happens once at the end.
    /// Access Control: The buyer, seller, and auditor addresses stored in this struct
    /// are used directly for Seal encryption access control via the seal_approve function.
    public struct Deal has key, store {
        id: UID,
        agreement_blob_id: String,    // Walrus blob ID for encrypted M&A agreement
        name: String,
        buyer: address,
        seller: address,
        auditor: address,
        start_date: u64,              // Unix timestamp (ms) when earn-out begins
        period_months: u64,           // Total earn-out duration in months
        kpi_threshold: u64,           // Cumulative KPI target to trigger payout
        max_payout: u64,              // Maximum earn-out payment amount
        headquarter: u64,             // Headquarter expense allocation percentage (1-100)
        assets: vector<Asset>,        // Fixed assets included in this deal

        // Subperiods for document organization
        subperiods: vector<Subperiod>,

        // Settlement state
        kpi_result: Option<KPIResult>,
        is_settled: bool,
        settled_amount: u64,

        // Parameters
        parameters_locked: bool,
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
    - Creates new Deal object with buyer/seller/auditor for Seal access control
    - Emits DealCreated event

    Access Control:
    - The buyer, seller, and auditor addresses are stored directly in the Deal
    - These addresses are used by seal_approve for Seal encryption access control
    - No separate Whitelist object needed
    */
    public fun create_deal(
        agreement_blob_id: String,
        name: String,
        seller: address,
        auditor: address,
        start_date: u64,
        period_months: u64,
        kpi_threshold: u64,
        max_payout: u64,
        headquarter: u64,
        asset_ids: vector<String>,
        asset_useful_lives: vector<u64>,
        subperiod_ids: vector<String>,
        subperiod_start_dates: vector<u64>,
        subperiod_end_dates: vector<u64>,
        ctx: &mut TxContext
    ) {
        let buyer = tx_context::sender(ctx);

        // Validate subperiod parameters
        let len = vector::length(&subperiod_ids);
        assert!(vector::length(&subperiod_start_dates) == len, EMismatchLength);
        assert!(vector::length(&subperiod_end_dates) == len, EMismatchLength);

        // Validate asset parameters
        let asset_len = vector::length(&asset_ids);
        assert!(vector::length(&asset_useful_lives) == asset_len, EMismatchLength);

        // Create assets vector
        let mut assets = vector::empty<Asset>();
        let mut i = 0;
        while (i < asset_len) {
            let asset = Asset {
                asset_id: *vector::borrow(&asset_ids, i),
                useful_life_months: *vector::borrow(&asset_useful_lives, i),
            };
            vector::push_back(&mut assets, asset);
            i = i + 1;
        };

        // Create Deal with all parameters set and locked
        let mut deal = Deal {
            id: object::new(ctx),
            agreement_blob_id,
            name,
            buyer,
            seller,
            auditor,
            start_date,
            period_months,
            kpi_threshold,
            max_payout,
            headquarter,
            assets,
            subperiods: vector::empty(),
            kpi_result: option::none(),
            is_settled: false,
            settled_amount: 0,
            parameters_locked: true,
        };

        // Create subperiods
        i = 0;
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

        let deal_id = object::id(&deal);

        event::emit(DealCreated {
            deal_id,
            whitelist_id: deal_id, // Use deal_id instead of whitelist_id for backward compatibility
            buyer,
            start_date,
        });

        transfer::share_object(deal);
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
        subperiod_id: String,
        blob_id: String,
        data_type: String,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(sender == deal.buyer, ENotBuyer);
        assert!(deal.parameters_locked, EParametersNotSet);

        let deal_id = object::id(deal);

        // Find the subperiod by ID
        let mut i = 0;
        let len = vector::length(&deal.subperiods);
        let mut found_index = option::none<u64>();

        while (i < len) {
            let temp_subperiod = vector::borrow(&deal.subperiods, i);
            if (temp_subperiod.id == subperiod_id) {
                found_index = option::some(i);
                break
            };
            i = i + 1;
        };

        assert!(option::is_some(&found_index), ESubperiodNotFound);
        let subperiod_index = option::destroy_some(found_index);
        let subperiod_ref = vector::borrow_mut(&mut deal.subperiods, subperiod_index);


        let subperiod_id_copy = subperiod_ref.id;
        let timestamp = clock::timestamp_ms(clock);

        let blob_ref = WalrusBlobRef {
            blob_id,
            data_type,
            uploaded_at: timestamp,
            uploader: sender,
        };

        vector::push_back(&mut subperiod_ref.walrus_blobs, blob_ref);

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

    /// Auditor audits a data record
    ///
    /// SIMPLIFIED VERSION: No off-chain signature verification
    /// The transaction itself serves as proof of auditor's intent:
    /// - Only the auditor can call this function (checked via deal.auditor)
    /// - The wallet signature on the transaction proves authenticity
    /// - This is more gas-efficient and avoids Ed25519/Blake2b compatibility issues
    public fun audit_data(
        deal: &Deal,
        audit_record: &mut DataAuditRecord,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);

        assert!(sender == deal.auditor, ENotAuditor);
        assert!(!audit_record.audited, EAlreadyAudited);
        assert!(audit_record.deal_id == object::id(deal), ENotAuthorized);

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

    /// Verify Nautilus TEE attestation
    ///
    /// PLACEHOLDER: This is currently a mock implementation for testing.
    ///
    /// In production, this function will verify:
    /// - Attestation format (144 bytes total):
    ///   - kpi_value: u64 (8 bytes, little-endian)
    ///   - computation_hash: 32 bytes (SHA-256 hash of input documents)
    ///   - timestamp: u64 (8 bytes, little-endian, Unix timestamp in milliseconds)
    ///   - tee_public_key: 32 bytes (Ed25519 public key)
    ///   - signature: 64 bytes (Ed25519 signature)
    /// - Ed25519 signature verification
    /// - TEE public key registry check
    /// - Timestamp freshness
    ///
    /// TODO: Implement full Nautilus TEE attestation verification when integrated
    public fun verify_nautilus_attestation(
        _attestation: &vector<u8>,
        _expected_kpi_value: u64,
    ): bool {
        // Mock implementation: Always return true for testing
        // Real implementation will verify TEE attestation signature and format
        true
    }

    /// Submit cumulative KPI result and execute settlement.
    ///
    /// This settles the entire deal based on cumulative KPI across all subperiods.
    /// Can be called multiple times until KPI threshold is met:
    /// - If kpi_value < kpi_threshold: deal.is_settled remains false, can resubmit
    /// - If kpi_value >= kpi_threshold: deal.is_settled becomes true, no more submissions
    ///
    /// NOTE: This is a simplified version for testing.
    /// - No actual token transfer is performed (to simplify testing)
    /// - max_payout is still calculated and stored
    /// - Previous KPI results are overwritten on resubmission
    #[allow(lint(self_transfer))]
    public fun submit_kpi_and_settle(
        deal: &mut Deal,
        kpi_type: String,
        kpi_value: u64,
        attestation: vector<u8>,
        payment: Coin<SUI>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(sender == deal.seller, ENotSeller);
        assert!(deal.parameters_locked, EParametersNotSet);
        assert!(!deal.is_settled, EAlreadySettled);
        // Removed: assert!(option::is_none(&deal.kpi_result), EKPIResultAlreadySubmitted);
        // Allow resubmission as long as deal is not settled (KPI threshold not met)

        // Verify attestation
        let is_valid = verify_nautilus_attestation(&attestation, kpi_value);
        assert!(is_valid, EInvalidAttestation);

        let deal_id = object::id(deal);
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

        // Simplified settlement: No actual token transfer (for testing convenience)
        // Just return the payment coin to sender
        transfer::public_transfer(payment, sender);

        // Mark deal as settled ONLY if KPI was met
        if (kpi_met) {
            deal.is_settled = true;
        };
        deal.settled_amount = payout_amount;

        event::emit(DealSettled {
            deal_id,
            kpi_value,
            kpi_met,
            payout_amount,
        });
    }

    // --- Seal Access Control ---

    /// Seal access control function for Deal-based encryption
    ///
    /// This function is called by Seal Key Servers to verify decryption access.
    /// Access is granted to the buyer, seller, or auditor of the Deal.
    ///
    /// Arguments:
    /// - id: The Deal object ID as bytes (32 bytes)
    /// - deal: Reference to the Deal controlling access
    /// - ctx: Transaction context (provides sender address)
    ///
    /// Aborts with ENoSealAccess if:
    /// - The id doesn't match this Deal's object ID
    /// - The caller is not a Deal participant (buyer/seller/auditor)
    entry fun seal_approve(id: vector<u8>, deal: &Deal, ctx: &TxContext) {
        let sender = tx_context::sender(ctx);

        // Verify the id matches the Deal's object ID
        let deal_id_bytes = object::id_to_bytes(&object::id(deal));

        // Compare all bytes
        assert!(vector::length(&id) == vector::length(&deal_id_bytes), ENoSealAccess);

        let mut i = 0;
        while (i < vector::length(&deal_id_bytes)) {
            let id_byte = *vector::borrow(&id, i);
            let deal_id_byte = *vector::borrow(&deal_id_bytes, i);
            assert!(id_byte == deal_id_byte, ENoSealAccess);
            i = i + 1;
        };

        // Check if sender is buyer, seller, or auditor
        let has_access = sender == deal.buyer || sender == deal.seller || sender == deal.auditor;
        assert!(has_access, ENoSealAccess);
    }

    /// Check if an address has access to decrypt data for this Deal
    ///
    /// This is a helper function that can be called by frontend or backend
    /// to verify access before attempting decryption.
    ///
    /// Arguments:
    /// - deal: Reference to the Deal
    /// - user: Address to check
    ///
    /// Returns: true if the user is buyer, seller, or auditor
    public fun has_decrypt_access(deal: &Deal, user: address): bool {
        user == deal.buyer || user == deal.seller || user == deal.auditor
    }

    // --- Accessor Functions ---

    // Deal accessors
    public fun deal_agreement_blob_id(deal: &Deal): String { deal.agreement_blob_id }
    public fun deal_start_date(deal: &Deal): u64 { deal.start_date }
    public fun deal_period_months(deal: &Deal): u64 { deal.period_months }
    public fun deal_kpi_threshold(deal: &Deal): u64 { deal.kpi_threshold }
    public fun deal_max_payout(deal: &Deal): u64 { deal.max_payout }
    public fun deal_headquarter(deal: &Deal): u64 { deal.headquarter }
    public fun deal_assets(deal: &Deal): &vector<Asset> { &deal.assets }
    public fun deal_is_settled(deal: &Deal): bool { deal.is_settled }
    public fun deal_settled_amount(deal: &Deal): u64 { deal.settled_amount }
    public fun deal_subperiod_count(deal: &Deal): u64 { vector::length(&deal.subperiods) }

    // Asset accessors
    public fun asset_id(asset: &Asset): String { asset.asset_id }
    public fun asset_useful_life_months(asset: &Asset): u64 { asset.useful_life_months }

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
