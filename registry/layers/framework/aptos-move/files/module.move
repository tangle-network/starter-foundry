module {{projectName}}::{{moduleName}} {
    use std::signer;
    use aptos_framework::event;

    /// Resource stored under the owner's account. Holds a u64 counter.
    struct Counter has key {
        owner: address,
        value: u64,
    }

    #[event]
    struct IncrementedEvent has drop, store {
        account: address,
        new_value: u64,
    }

    /// Error: trying to initialize a Counter that already exists.
    const E_ALREADY_INITIALIZED: u64 = 1;
    /// Error: trying to read/increment a Counter that was never initialized.
    const E_NOT_INITIALIZED: u64 = 2;

    /// Called once per account to publish a Counter resource under `account`.
    public entry fun initialize(account: &signer) {
        let owner = signer::address_of(account);
        assert!(!exists<Counter>(owner), E_ALREADY_INITIALIZED);
        move_to(account, Counter { owner, value: 0 });
    }

    /// Increments the Counter stored under the caller's address. Emits an event.
    public entry fun increment(account: &signer) acquires Counter {
        let owner = signer::address_of(account);
        assert!(exists<Counter>(owner), E_NOT_INITIALIZED);
        let counter = borrow_global_mut<Counter>(owner);
        counter.value = counter.value + 1;
        event::emit(IncrementedEvent { account: owner, new_value: counter.value });
    }

    #[view]
    public fun value_of(owner: address): u64 acquires Counter {
        if (exists<Counter>(owner)) {
            borrow_global<Counter>(owner).value
        } else {
            0
        }
    }
}
