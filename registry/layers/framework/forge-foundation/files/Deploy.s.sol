// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { {{contractName}} } from "../src/{{contractName}}.sol";

contract DeployScript {
    function run() external returns ({{contractName}} deployed) {
        deployed = new {{contractName}}();
    }
}
