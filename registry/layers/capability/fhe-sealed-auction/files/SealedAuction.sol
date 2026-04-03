// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@fhenixprotocol/contracts/FHE.sol";

/// @title SealedAuction — sealed-bid auction using FHE
/// @dev Bids are encrypted; highest bidder determined homomorphically.
contract SealedAuction {
    address public owner;
    bool public ended;
    uint256 public endTime;

    euint32 private _highestBid;
    address private _highestBidder;

    mapping(address => euint32) private _bids;
    mapping(address => bool) public hasBid;

    constructor(uint256 durationSeconds) {
        owner = msg.sender;
        endTime = block.timestamp + durationSeconds;
        _highestBid = FHE.asEuint32(0);
    }

    function bid(inEuint32 calldata encryptedBid) external {
        require(block.timestamp < endTime, "Auction ended");
        require(!hasBid[msg.sender], "Already bid");

        euint32 bidAmount = FHE.asEuint32(encryptedBid);
        _bids[msg.sender] = bidAmount;
        hasBid[msg.sender] = true;

        // Homomorphic comparison: update highest if this bid is greater
        ebool isHigher = FHE.gt(bidAmount, _highestBid);
        _highestBid = FHE.select(isHigher, bidAmount, _highestBid);
    }

    function endAuction() external {
        require(msg.sender == owner, "Only owner");
        require(block.timestamp >= endTime, "Not ended yet");
        ended = true;
    }

    function getHighestBid(bytes32 publicKey) external view returns (bytes memory) {
        require(ended, "Auction not ended");
        return FHE.sealoutput(_highestBid, publicKey);
    }

    function getMyBid(bytes32 publicKey) external view returns (bytes memory) {
        require(hasBid[msg.sender], "No bid");
        return FHE.sealoutput(_bids[msg.sender], publicKey);
    }
}
