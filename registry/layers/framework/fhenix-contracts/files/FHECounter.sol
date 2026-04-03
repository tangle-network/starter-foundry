// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {FHE, euint32, InEuint32} from "@fhenixprotocol/cofhe-contracts/FHE.sol";

contract FHECounter {
    euint32 public count;
    address public owner;

    constructor() {
        owner = msg.sender;
        count = FHE.asEuint32(0);
        FHE.allowThis(count);
    }

    function increment(InEuint32 calldata encryptedAmount) public {
        euint32 amount = FHE.asEuint32(encryptedAmount);
        count = FHE.add(count, amount);
        FHE.allowThis(count);
        FHE.allowSender(count);
    }

    function getCount() public view returns (euint32) {
        return count;
    }
}
