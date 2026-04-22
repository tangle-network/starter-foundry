module package::{{moduleName}} {
    use std::signer;

    struct Treasury has key {
        owner: address,
        balance: u64,
    }

    public entry fun initialize(account: &signer) {
        let owner = signer::address_of(account);
        move_to(account, Treasury { owner, balance: 0 });
    }

    #[view]
    public fun balance(owner: address): u64 acquires Treasury {
        if (exists<Treasury>(owner)) {
            borrow_global<Treasury>(owner).balance
        } else {
            0
        }
    }
}
