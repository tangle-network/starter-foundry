// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@fhenixprotocol/contracts/FHE.sol";

contract FHECounter {
    euint32 private _count;
    address public owner;

    constructor() {
        owner = msg.sender;
        _count = FHE.asEuint32(0);
    }

    function increment(inEuint32 calldata encryptedAmount) public {
        euint32 amount = FHE.asEuint32(encryptedAmount);
        _count = FHE.add(_count, amount);
    }

    function getCount(bytes32 publicKey) public view returns (bytes memory) {
        return FHE.sealoutput(_count, publicKey);
    }
}
