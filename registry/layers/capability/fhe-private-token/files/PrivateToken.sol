// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@fhenixprotocol/contracts/FHE.sol";

/// @title PrivateToken — ERC20-like token with encrypted balances using FHE
/// @dev Balances and transfer amounts are encrypted; only the owner can unseal their balance.
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
    }

    function mint(address to, inEuint32 calldata encryptedAmount) external {
        require(msg.sender == minter, "Only minter");
        euint32 amount = FHE.asEuint32(encryptedAmount);
        _balances[to] = FHE.add(_balances[to], amount);
        _totalSupply = FHE.add(_totalSupply, amount);
    }

    function transfer(address to, inEuint32 calldata encryptedAmount) external {
        euint32 amount = FHE.asEuint32(encryptedAmount);

        // Check sender has sufficient balance (homomorphic comparison)
        ebool sufficient = FHE.gte(_balances[msg.sender], amount);
        require(FHE.decrypt(sufficient), "Insufficient balance");

        _balances[msg.sender] = FHE.sub(_balances[msg.sender], amount);
        _balances[to] = FHE.add(_balances[to], amount);

        emit Transfer(msg.sender, to);
    }

    function balanceOf(address account, bytes32 publicKey) external view returns (bytes memory) {
        return FHE.sealoutput(_balances[account], publicKey);
    }

    function totalSupply(bytes32 publicKey) external view returns (bytes memory) {
        return FHE.sealoutput(_totalSupply, publicKey);
    }
}
