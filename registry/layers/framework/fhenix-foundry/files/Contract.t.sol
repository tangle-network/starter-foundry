// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {FHE, euint32, ebool, InEuint32} from "@fhenixprotocol/cofhe-contracts/FHE.sol";
import { {{contractName}} } from "../src/{{contractName}}.sol";

/// @dev Foundry test. With the vendored CoFHE surface, encrypted handles are
///      deterministic locally, so we can assert end-to-end. Against the real
///      coprocessor, drive these through the CoFHE test harness instead.
contract {{contractName}}Test {
    {{contractName}} internal target;

    function setUp() public {
        target = new {{contractName}}();
    }

    function _sealedInput(uint256 value) internal pure returns (InEuint32 memory) {
        return InEuint32({ ctHash: value, securityZone: 0, utype: 0, signature: "" });
    }

    function test_submit_accumulates_encrypted_state() public {
        target.submit(_sealedInput(7));
        target.submit(_sealedInput(5));
        // Encrypted state is a ciphertext handle; with the local vendored surface
        // the handle carries the folded value. On-chain it stays opaque.
        euint32 handle = target.encryptedValue();
        assert(euint32.unwrap(handle) == 12);
    }

    function test_isAtLeast_returns_encrypted_bool() public {
        target.submit(_sealedInput(10));
        ebool atLeast = target.isAtLeast(_sealedInput(8));
        assert(ebool.unwrap(atLeast) == 1);
    }

    function test_owner_is_deployer() public view {
        assert(target.owner() == address(this));
    }
}
