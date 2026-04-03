// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {FHE, euint32, InEuint32, ebool} from "@fhenixprotocol/cofhe-contracts/FHE.sol";

/// @title SealedAuction — sealed-bid auction using CoFHE
/// @dev Bids are encrypted; highest bidder determined homomorphically.
contract SealedAuction {
    address public owner;
    bool public ended;
    uint256 public endTime;

    euint32 private _highestBid;
    mapping(address => euint32) private _bids;
    mapping(address => bool) public hasBid;

    constructor(uint256 durationSeconds) {
        owner = msg.sender;
        endTime = block.timestamp + durationSeconds;
        _highestBid = FHE.asEuint32(0);
        FHE.allowThis(_highestBid);
    }

    function bid(InEuint32 calldata encryptedBid) external {
        require(block.timestamp < endTime, "Auction ended");
        require(!hasBid[msg.sender], "Already bid");

        euint32 bidAmount = FHE.asEuint32(encryptedBid);
        _bids[msg.sender] = bidAmount;
        hasBid[msg.sender] = true;

        ebool isHigher = FHE.gt(bidAmount, _highestBid);
        _highestBid = FHE.select(isHigher, bidAmount, _highestBid);
        FHE.allowThis(_highestBid);
        FHE.allowSender(bidAmount);
    }

    function endAuction() external {
        require(msg.sender == owner, "Only owner");
        require(block.timestamp >= endTime, "Not ended yet");
        ended = true;
    }
}
