// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, ebool, euint64, externalEbool} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title PrivateVoting
/// @notice Encrypted on-chain voting using Zama fhEVM encrypted conditionals.
contract PrivateVoting is ZamaEthereumConfig {
    address public owner;
    bool public finalized;
    uint256 public endTime;

    euint64 private _yesVotes;
    euint64 private _noVotes;
    mapping(address => bool) public hasVoted;

    constructor(uint256 durationSeconds) {
        owner = msg.sender;
        endTime = block.timestamp + durationSeconds;
        _yesVotes = FHE.asEuint64(0);
        _noVotes = FHE.asEuint64(0);
        FHE.allowThis(_yesVotes);
        FHE.allowThis(_noVotes);
    }

    function vote(externalEbool encryptedSupport, bytes calldata inputProof) external {
        require(block.timestamp < endTime, "Voting ended");
        require(!hasVoted[msg.sender], "Already voted");

        ebool support = FHE.fromExternal(encryptedSupport, inputProof);

        hasVoted[msg.sender] = true;
        _yesVotes = FHE.select(support, FHE.add(_yesVotes, 1), _yesVotes);
        _noVotes = FHE.select(support, _noVotes, FHE.add(_noVotes, 1));
        FHE.allowThis(_yesVotes);
        FHE.allowThis(_noVotes);
    }

    function finalize() external {
        require(msg.sender == owner, "Only owner");
        require(block.timestamp >= endTime, "Not ended yet");
        finalized = true;
        FHE.allow(_yesVotes, msg.sender);
        FHE.allow(_noVotes, msg.sender);
    }

    function encryptedTallies() external view returns (euint64 yesVotes, euint64 noVotes) {
        return (_yesVotes, _noVotes);
    }
}
