// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {FHE, euint32, InEuint32, ebool} from "@fhenixprotocol/cofhe-contracts/FHE.sol";

/// @title PrivateToken — ERC20-like token with encrypted balances using CoFHE
contract PrivateToken {
    string public name;
    string public symbol;
    address public minter;

    mapping(address => euint32) private _balances;
    euint32 private _totalSupply;

    event Transfer(address indexed from, address indexed to);

    constructor(string memory _name, string memory _symbol) {
        name = _name;
        symbol = _symbol;
        minter = msg.sender;
        _totalSupply = FHE.asEuint32(0);
        FHE.allowThis(_totalSupply);
    }

    function mint(address to, InEuint32 calldata encryptedAmount) external {
        require(msg.sender == minter, "Only minter");
        euint32 amount = FHE.asEuint32(encryptedAmount);
        _balances[to] = FHE.add(_balances[to], amount);
        _totalSupply = FHE.add(_totalSupply, amount);
        FHE.allowThis(_balances[to]);
        FHE.allowThis(_totalSupply);
        FHE.allow(_balances[to], to);
    }

    function transfer(address to, InEuint32 calldata encryptedAmount) external {
        euint32 amount = FHE.asEuint32(encryptedAmount);
        ebool sufficient = FHE.gte(_balances[msg.sender], amount);
        require(FHE.decrypt(sufficient), "Insufficient balance");

        _balances[msg.sender] = FHE.sub(_balances[msg.sender], amount);
        _balances[to] = FHE.add(_balances[to], amount);
        FHE.allowThis(_balances[msg.sender]);
        FHE.allowThis(_balances[to]);
        FHE.allow(_balances[msg.sender], msg.sender);
        FHE.allow(_balances[to], to);

        emit Transfer(msg.sender, to);
    }
}
