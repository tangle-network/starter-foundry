// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, InEuint64} from "@fhevm/solidity/lib/FHE.sol";

contract EncryptedCounter {
    euint64 private _count;
    address public owner;

    constructor() {
        owner = msg.sender;
        _count = FHE.asEuint64(0);
    }

    function increment(InEuint64 calldata encryptedAmount) public {
        euint64 amount = FHE.asEuint64(encryptedAmount);
        _count = FHE.add(_count, amount);
    }

    function decrement(InEuint64 calldata encryptedAmount) public {
        euint64 amount = FHE.asEuint64(encryptedAmount);
        _count = FHE.sub(_count, amount);
    }

    function getCount() public view returns (euint64) {
        return _count;
    }
}
