module {{projectName}}::{{moduleName}}Tests {
    use {{projectName}}::{{moduleName}};

    #[test(account = @{{projectName}})]
    fun initializes_balance(account: signer) {
        {{moduleName}}::initialize(&account);
        assert!({{moduleName}}::balance(@{{projectName}}) == 0, 0);
    }
}
