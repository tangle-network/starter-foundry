// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@fhenixprotocol/contracts/FHE.sol";

/// @title PrivateVoting — encrypted on-chain voting using FHE
/// @dev Votes are encrypted; tally computed homomorphically without revealing individual votes.
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
    }

    /// @param encryptedVote Encrypted 1 for yes, 0 for no
    function vote(inEuint32 calldata encryptedVote) external {
        require(block.timestamp < endTime, "Voting ended");
        require(!hasVoted[msg.sender], "Already voted");

        euint32 v = FHE.asEuint32(encryptedVote);
        hasVoted[msg.sender] = true;

        // Homomorphic tally: add vote to yes/no counters
        ebool isYes = FHE.gt(v, FHE.asEuint32(0));
        euint32 one = FHE.asEuint32(1);
        _yesVotes = FHE.add(_yesVotes, FHE.select(isYes, one, FHE.asEuint32(0)));
        _noVotes = FHE.add(_noVotes, FHE.select(isYes, FHE.asEuint32(0), one));
    }

    function finalize() external {
        require(msg.sender == owner, "Only owner");
        require(block.timestamp >= endTime, "Not ended yet");
        finalized = true;
    }

    function getResults(bytes32 publicKey) external view returns (bytes memory yesSealed, bytes memory noSealed) {
        require(finalized, "Not finalized");
        yesSealed = FHE.sealoutput(_yesVotes, publicKey);
        noSealed = FHE.sealoutput(_noVotes, publicKey);
    }
}
