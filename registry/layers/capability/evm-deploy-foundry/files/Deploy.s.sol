// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { {{contractName}} } from "../src/{{contractName}}.sol";

contract DeployScript {
    function run() external returns ({{contractName}} deployed) {
        // Read PRIVATE_KEY in the real deploy flow, then broadcast against the configured chain.
        deployed = new {{contractName}}();
    }
}
