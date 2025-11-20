module contracts::whitelist {
    use sui::table::{Self, Table};
    use sui::event;

    // --- Error Codes ---
    const ENoAccess: u64 = 1;
    const EInvalidCap: u64 = 2;
    const EWrongVersion: u64 = 5;

    const VERSION: u64 = 1;

    // --- Structs ---

    public struct Whitelist has key, store {
        id: UID,
        version: u64,
        addresses: Table<address, bool>,
    }

    public struct Cap has key, store {
        id: UID,
        wl_id: ID,
    }

    // --- Events ---
    public struct WhitelistCreated has copy, drop { id: ID }

    // --- Functions ---

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
        event::emit(WhitelistCreated { id: object::id(&wl) });
        (cap, wl)
    }

    // [Fix]: 使用 public_share_object 以消除 lint warning
    public fun share_whitelist(wl: Whitelist) {
        transfer::public_share_object(wl);
    }

    public fun add(wl: &mut Whitelist, cap: &Cap, account: address) {
        assert!(cap.wl_id == object::id(wl), EInvalidCap);
        if (!table::contains(&wl.addresses, account)) {
            table::add(&mut wl.addresses, account, true);
        }
    }

    public fun remove(wl: &mut Whitelist, cap: &Cap, account: address) {
        assert!(cap.wl_id == object::id(wl), EInvalidCap);
        if (table::contains(&wl.addresses, account)) {
            table::remove(&mut wl.addresses, account);
        }
    }

    // --- Seal Integration Functions ---

    public fun check_policy(caller: address, id: vector<u8>, wl: &Whitelist): bool {
        assert!(wl.version == VERSION, EWrongVersion);
        
        let prefix = object::id(wl).to_bytes();
        let mut i = 0;
        if (vector::length(&prefix) > vector::length(&id)) {
            return false
        };
        while (i < vector::length(&prefix)) {
            if (*vector::borrow(&prefix, i) != *vector::borrow(&id, i)) {
                return false
            };
            i = i + 1;
        };

        table::contains(&wl.addresses, caller)
    }

    // [Fix]: 移除 entry，改為 public fun
    public fun seal_approve(id: vector<u8>, wl: &Whitelist, ctx: &TxContext) {
        assert!(check_policy(ctx.sender(), id, wl), ENoAccess);
    }
    
    public fun whitelist_id(cap: &Cap): ID {
        cap.wl_id
    }
    
    // Test helper
    #[test_only]
    public fun destroy_for_testing(wl: Whitelist, cap: Cap) {
        let Whitelist { id, version: _, addresses } = wl;
        addresses.drop();
        object::delete(id);
        let Cap { id: cap_id, wl_id: _ } = cap;
        object::delete(cap_id);
    }
}