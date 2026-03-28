// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { {{contractName}} } from "../src/{{contractName}}.sol";

contract SendTokensScript {
    function run({{contractName}} token, uint32 destinationChain, address recipient, uint256 amount) external returns (bytes32) {
        return token.sendTokens(destinationChain, recipient, amount);
    }
}
