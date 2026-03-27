// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { {{contractName}} } from "../src/{{contractName}}.sol";

contract {{contractName}}Test {
    {{contractName}} internal counter;

    function setUp() public {
        counter = new {{contractName}}();
    }

    function test_set_and_get() public {
        counter.set(42);
        assert(counter.get() == 42);
    }
}
