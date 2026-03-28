// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { {{contractName}} } from "../src/{{contractName}}.sol";

contract MintWithBundlerScript {
    function run({{contractName}} collectible, address recipient) external returns (uint256) {
        // In the real product flow this would be wrapped by a bundler or paymaster.
        return collectible.mint(recipient);
    }
}
