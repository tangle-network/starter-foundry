// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { {{contractName}} } from "../src/{{contractName}}.sol";

/// @dev Foundry deploy script. Broadcast against the Fhenix network:
///      forge script script/Deploy.s.sol --rpc-url $FHENIX_RPC_URL --broadcast
contract DeployScript {
    function run() external returns ({{contractName}} deployed) {
        deployed = new {{contractName}}();
    }
}
