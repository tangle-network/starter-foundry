#[test_only]
module {{projectName}}::{{moduleName}}Tests {
    use {{projectName}}::{{moduleName}};

    #[test(account = @{{projectName}})]
    fun initializes_to_zero(account: signer) {
        {{moduleName}}::initialize(&account);
        assert!({{moduleName}}::value_of(@{{projectName}}) == 0, 100);
    }

    #[test(account = @{{projectName}})]
    fun increments_counter(account: signer) {
        {{moduleName}}::initialize(&account);
        {{moduleName}}::increment(&account);
        {{moduleName}}::increment(&account);
        assert!({{moduleName}}::value_of(@{{projectName}}) == 2, 101);
    }

    #[test(account = @{{projectName}})]
    #[expected_failure(abort_code = 1, location = {{projectName}}::{{moduleName}})]
    fun rejects_double_init(account: signer) {
        {{moduleName}}::initialize(&account);
        {{moduleName}}::initialize(&account);
    }

    #[test]
    fun value_of_uninitialized_is_zero() {
        assert!({{moduleName}}::value_of(@0xDEAD) == 0, 102);
    }
}
