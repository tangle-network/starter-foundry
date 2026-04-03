// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {FHE, euint32, InEuint32, ebool} from "@fhenixprotocol/cofhe-contracts/FHE.sol";

/// @title PrivateVoting — encrypted on-chain voting using CoFHE
/// @dev Votes are encrypted; tally computed homomorphically.
contract PrivateVoting {
    address public owner;
    bool public finalized;
    uint256 public endTime;

    euint32 private _yesVotes;
    euint32 private _noVotes;
    mapping(address => bool) public hasVoted;

    constructor(uint256 durationSeconds) {
        owner = msg.sender;
        endTime = block.timestamp + durationSeconds;
        _yesVotes = FHE.asEuint32(0);
        _noVotes = FHE.asEuint32(0);
        FHE.allowThis(_yesVotes);
        FHE.allowThis(_noVotes);
    }

    /// @param encryptedVote Encrypted 1 for yes, 0 for no
    function vote(InEuint32 calldata encryptedVote) external {
        require(block.timestamp < endTime, "Voting ended");
        require(!hasVoted[msg.sender], "Already voted");

        euint32 v = FHE.asEuint32(encryptedVote);
        hasVoted[msg.sender] = true;

        euint32 one = FHE.asEuint32(1);
        euint32 zero = FHE.asEuint32(0);
        ebool isYes = FHE.gt(v, zero);
        _yesVotes = FHE.add(_yesVotes, FHE.select(isYes, one, zero));
        _noVotes = FHE.add(_noVotes, FHE.select(isYes, zero, one));
        FHE.allowThis(_yesVotes);
        FHE.allowThis(_noVotes);
    }

    function finalize() external {
        require(msg.sender == owner, "Only owner");
        require(block.timestamp >= endTime, "Not ended yet");
        finalized = true;
        FHE.allowSender(_yesVotes);
        FHE.allowSender(_noVotes);
    }
}
