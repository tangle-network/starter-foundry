// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { {{contractName}} } from "../src/{{contractName}}.sol";

contract {{contractName}}Test {
    {{contractName}} internal token;

    function setUp() public {
        token = new {{contractName}}();
    }

    function test_send_tokens_updates_balances() public {
        address recipient = address(0xBEEF);
        token.sendTokens(30184, recipient, 100 ether);
        assert(token.balanceOf(recipient) == 100 ether);
    }
}
