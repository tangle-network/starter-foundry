#[test_only]
module module_addr::{{MODULE_NAME}}Tests {
    use module_addr::{{MODULE_NAME}};

    #[test(account = @module_addr)]
    fun initializes_to_zero(account: signer) {
        {{MODULE_NAME}}::initialize(&account);
        assert!({{MODULE_NAME}}::value_of(@module_addr) == 0, 100);
    }

    #[test(account = @module_addr)]
    fun increments_counter(account: signer) {
        {{MODULE_NAME}}::initialize(&account);
        {{MODULE_NAME}}::increment(&account);
        {{MODULE_NAME}}::increment(&account);
        assert!({{MODULE_NAME}}::value_of(@module_addr) == 2, 101);
    }

    #[test(account = @module_addr)]
    #[expected_failure(abort_code = 1, location = module_addr::{{MODULE_NAME}})]
    fun rejects_double_init(account: signer) {
        {{MODULE_NAME}}::initialize(&account);
        {{MODULE_NAME}}::initialize(&account);
    }

    #[test]
    fun value_of_uninitialized_is_zero() {
        assert!({{MODULE_NAME}}::value_of(@0xDEAD) == 0, 102);
    }
}
