// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title SealedAuction
/// @notice Sealed-bid auction using Zama fhEVM encrypted conditionals.
contract SealedAuction is ZamaEthereumConfig {
    address public owner;
    bool public ended;
    uint256 public endTime;

    euint64 private _highestBid;
    mapping(address => euint64) private _bids;
    mapping(address => bool) public hasBid;

    constructor(uint256 durationSeconds) {
        owner = msg.sender;
        endTime = block.timestamp + durationSeconds;
        _highestBid = FHE.asEuint64(0);
        FHE.allowThis(_highestBid);
    }

    function bid(externalEuint64 encryptedBid, bytes calldata inputProof) external {
        require(block.timestamp < endTime, "Auction ended");
        require(!hasBid[msg.sender], "Already bid");

        euint64 bidAmount = FHE.fromExternal(encryptedBid, inputProof);
        euint64 nextHighest = FHE.select(FHE.gte(bidAmount, _highestBid), bidAmount, _highestBid);

        _bids[msg.sender] = bidAmount;
        _highestBid = nextHighest;
        hasBid[msg.sender] = true;

        FHE.allowThis(_bids[msg.sender]);
        FHE.allowThis(_highestBid);
        FHE.allow(_bids[msg.sender], msg.sender);
    }

    function endAuction() external {
        require(msg.sender == owner, "Only owner");
        require(block.timestamp >= endTime, "Not ended yet");
        ended = true;
        FHE.allow(_highestBid, msg.sender);
    }

    function encryptedBidOf(address bidder) external view returns (euint64) {
        return _bids[bidder];
    }

    function encryptedHighestBid() external view returns (euint64) {
        return _highestBid;
    }
}
