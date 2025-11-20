// Copyright (c), Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

/// Whitelist pattern:
/// - Anyone can create a whitelist which defines a unique key-id.
/// - Anyone can encrypt to that key-id.
/// - Anyone on the whitelist can request the key associated with the whitelist's key-id,
///   allowing it to decrypt all data encrypted to that key-id.
///
/// Use cases that can be built on top of this: subscription based access to encrypted files.
///
/// Similar patterns:
/// - Whitelist with temporary privacy: same whitelist as below, but also store created_at: u64.
///   After a fixed TTL anyone can access the key, regardless of being on the whitelist.
///   Temporary privacy can be useful for compliance reasons, e.g., GDPR.
///
/// This pattern implements versioning per whitelist.
///
module contracts::whitelist;

use sui::table;

// ============================================
// Error codes
// ============================================

/// Error: Caller is not on the whitelist or key-id prefix doesn't match
const ENoAccess: u64 = 1;
/// Error: The provided Cap does not match this Whitelist
const EInvalidCap: u64 = 2;
/// Error: Address is already in the whitelist
const EDuplicate: u64 = 3;
/// Error: Address is not in the whitelist (cannot remove)
const ENotInWhitelist: u64 = 4;
/// Error: Whitelist version mismatch (needs upgrade)
const EWrongVersion: u64 = 5;

/// Current version of the whitelist schema (for future upgrades)
const VERSION: u64 = 1;

// ============================================
// Core data structures
// ============================================

/// Whitelist object - a shared object that stores authorized addresses
///
/// This object is created by an admin and shared publicly. Anyone can
/// encrypt data using this whitelist's ID as part of the key-id, and
/// only addresses in the `addresses` table can decrypt that data.
public struct Whitelist has key {
    id: UID,
    /// Version number for upgrade compatibility
    version: u64,
    /// Table mapping address -> bool (true = whitelisted)
    /// Using Table for O(1) lookup performance
    addresses: table::Table<address, bool>,
}

/// Admin capability for managing a specific Whitelist
///
/// Only the holder of this Cap can add/remove addresses from the
/// associated Whitelist. This Cap is transferable, allowing admin
/// rights to be delegated or sold.
public struct Cap has key, store {
    id: UID,
    /// The ID of the Whitelist this Cap controls
    wl_id: ID,
}

// ============================================
// Whitelist creation and management
// ============================================

/// Create a whitelist with an admin cap.
///
/// The associated key-ids are [pkg id][whitelist id][nonce] for any nonce (thus
/// many key-ids can be created for the same whitelist).
///
/// Returns:
/// - Cap: Admin capability for managing this whitelist
/// - Whitelist: The whitelist object (should be shared via share_whitelist)
public fun create_whitelist(ctx: &mut TxContext): (Cap, Whitelist) {
    let wl = Whitelist {
        id: object::new(ctx),
        version: VERSION,
        addresses: table::new(ctx),
    };
    let cap = Cap {
        id: object::new(ctx),
        wl_id: object::id(&wl),
    };
    (cap, wl)
}

/// Share the whitelist as a public shared object
///
/// After sharing, anyone can read the whitelist to check membership,
/// but only the Cap holder can modify it.
public fun share_whitelist(wl: Whitelist) {
    transfer::share_object(wl);
}

/// Entry function: Create a whitelist, share it, and transfer Cap to sender
///
/// This is a convenience function that performs all setup steps:
/// 1. Creates a new Whitelist and Cap
/// 2. Shares the Whitelist publicly
/// 3. Transfers the Cap to the transaction sender
entry fun create_whitelist_entry(ctx: &mut TxContext) {
    let (cap, wl) = create_whitelist(ctx);
    share_whitelist(wl);
    transfer::public_transfer(cap, ctx.sender());
}

/// Add an address to the whitelist
///
/// Arguments:
/// - wl: Mutable reference to the Whitelist
/// - cap: Reference to the admin Cap (proves authorization)
/// - account: Address to add to the whitelist
///
/// Aborts if:
/// - Cap doesn't match this Whitelist (EInvalidCap)
/// - Address is already whitelisted (EDuplicate)
public fun add(wl: &mut Whitelist, cap: &Cap, account: address) {
    assert!(cap.wl_id == object::id(wl), EInvalidCap);
    assert!(!wl.addresses.contains(account), EDuplicate);
    wl.addresses.add(account, true);
}

/// Remove an address from the whitelist
///
/// Arguments:
/// - wl: Mutable reference to the Whitelist
/// - cap: Reference to the admin Cap (proves authorization)
/// - account: Address to remove from the whitelist
///
/// Aborts if:
/// - Cap doesn't match this Whitelist (EInvalidCap)
/// - Address is not in the whitelist (ENotInWhitelist)
public fun remove(wl: &mut Whitelist, cap: &Cap, account: address) {
    assert!(cap.wl_id == object::id(wl), EInvalidCap);
    assert!(wl.addresses.contains(account), ENotInWhitelist);
    wl.addresses.remove(account);
}

// Cap can also be used to upgrade the version of Whitelist in future versions,
// see https://docs.sui.io/concepts/sui-move-concepts/packages/upgrade#versioned-shared-objects

// ============================================
// Access control (Seal integration)
// ============================================

/// Key format: [pkg id][whitelist id][random nonce]
/// (Alternative key format: [pkg id][creator address][random nonce] - see private_data.move)

/// Internal function to verify if a caller can access a specific key-id
///
/// This function performs two checks:
/// 1. Prefix check: The key-id must start with this whitelist's object ID
/// 2. Membership check: The caller must be in the whitelist
///
/// Arguments:
/// - caller: Address requesting access
/// - id: The full key-id being requested (includes whitelist ID prefix + nonce)
/// - wl: Reference to the Whitelist
///
/// Returns: true if access should be granted, false otherwise
fun check_policy(caller: address, id: vector<u8>, wl: &Whitelist): bool {
    // Check we are using the right version of the package.
    // This ensures compatibility during contract upgrades.
    assert!(wl.version == VERSION, EWrongVersion);

    // Check if the id has the right prefix (whitelist object ID)
    // This ensures the key-id was created for this specific whitelist
    let prefix = wl.id.to_bytes();
    let mut i = 0;

    // If prefix is longer than id, it can't possibly match
    if (prefix.length() > id.length()) {
        return false
    };

    // Compare byte-by-byte to verify prefix match
    while (i < prefix.length()) {
        if (prefix[i] != id[i]) {
            return false
        };
        i = i + 1;
    };

    // Finally, check if the caller is in the whitelist
    wl.addresses.contains(caller)
}

/// Entry function called by Seal Key Servers to verify decryption access
///
/// When a user requests a decryption key from a Seal Key Server, the server
/// calls this function to verify the user's access rights. If the function
/// completes without aborting, access is granted.
///
/// Arguments:
/// - id: The key-id being requested for decryption
/// - wl: Reference to the Whitelist controlling access
/// - ctx: Transaction context (provides sender address)
///
/// Aborts with ENoAccess if:
/// - The key-id prefix doesn't match this whitelist
/// - The caller is not in the whitelist
entry fun seal_approve(id: vector<u8>, wl: &Whitelist, ctx: &TxContext) {
    assert!(check_policy(ctx.sender(), id, wl), ENoAccess);
}

// ============================================
// Test helpers
// ============================================

/// Destroy whitelist and cap for testing purposes only
///
/// This function properly cleans up all resources to avoid memory leaks
/// in tests. It cannot be called in production code.
#[test_only]
public fun destroy_for_testing(wl: Whitelist, cap: Cap) {
    let Whitelist { id, version: _, addresses } = wl;
    addresses.drop();
    object::delete(id);
    let Cap { id, .. } = cap;
    object::delete(id);
}

// ============================================
// Unit tests
// ============================================

#[test]
fun test_approve() {
    let ctx = &mut tx_context::dummy();
    let (cap, mut wl) = create_whitelist(ctx);

    // Test adding and removing addresses
    wl.add(&cap, @0x1);
    wl.remove(&cap, @0x1);
    wl.add(&cap, @0x2);

    // Test 1: Fail for invalid id (doesn't have whitelist prefix)
    assert!(!check_policy(@0x2, b"123", &wl), 1);

    // Test 2: Work for valid id - user 2 is in the whitelist
    // Construct a valid key-id: [whitelist object id][nonce]
    let mut obj_id = object::id(&wl).to_bytes();
    obj_id.push_back(11); // Append arbitrary nonce
    assert!(check_policy(@0x2, obj_id, &wl), 1);

    // Test 3: Fail for user 1 (was removed from whitelist)
    assert!(!check_policy(@0x1, obj_id, &wl), 1);

    destroy_for_testing(wl, cap);
}
