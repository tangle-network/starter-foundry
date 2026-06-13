// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {FHE, euint32, InEuint32} from "@fhenixprotocol/cofhe-contracts/FHE.sol";

/// @title SealedAuction
/// @notice Sealed-bid auction where bids stay encrypted and winner state is selected homomorphically.
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
        euint32 nextHighest = FHE.select(FHE.gte(bidAmount, _highestBid), bidAmount, _highestBid);

        _bids[msg.sender] = bidAmount;
        _highestBid = nextHighest;
        hasBid[msg.sender] = true;

        FHE.allowThis(_bids[msg.sender]);
        FHE.allowThis(_highestBid);
        FHE.allowSender(bidAmount);
    }

    function endAuction() external {
        require(msg.sender == owner, "Only owner");
        require(block.timestamp >= endTime, "Not ended yet");
        ended = true;
        FHE.allowSender(_highestBid);
    }

    function encryptedBidOf(address bidder) external view returns (euint32) {
        return _bids[bidder];
    }

    function encryptedHighestBid() external view returns (euint32) {
        return _highestBid;
    }
}
