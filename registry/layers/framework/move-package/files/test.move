module package::{{moduleName}}Tests {
    #[test(account = @package)]
    fun initializes_balance(account: signer) {
        package::{{moduleName}}::initialize(&account);
        assert!(package::{{moduleName}}::balance(@package) == 0, 0);
    }
}
