// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {FHE, euint32, InEuint32} from "@fhenixprotocol/cofhe-contracts/FHE.sol";

/// @title PrivateVoting
/// @notice Encrypted on-chain voting where ballots and tallies stay ciphertexts.
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

    function vote(InEuint32 calldata encryptedVote) external {
        require(block.timestamp < endTime, "Voting ended");
        require(!hasVoted[msg.sender], "Already voted");

        euint32 voteValue = FHE.asEuint32(encryptedVote);
        euint32 one = FHE.asEuint32(1);
        euint32 zero = FHE.asEuint32(0);
        euint32 normalizedYes = FHE.select(FHE.gte(voteValue, one), one, zero);
        euint32 normalizedNo = FHE.select(FHE.gte(voteValue, one), zero, one);

        hasVoted[msg.sender] = true;
        _yesVotes = FHE.add(_yesVotes, normalizedYes);
        _noVotes = FHE.add(_noVotes, normalizedNo);
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

    function encryptedTallies() external view returns (euint32 yesVotes, euint32 noVotes) {
        return (_yesVotes, _noVotes);
    }
}
