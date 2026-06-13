// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title PrivateToken
/// @notice ERC20-like token with encrypted balances using Zama fhEVM.
contract PrivateToken is ZamaEthereumConfig {
    string public name;
    string public symbol;
    address public minter;

    mapping(address => euint64) private _balances;
    euint64 private _totalSupply;

    event Transfer(address indexed from, address indexed to);

    constructor(string memory tokenName, string memory tokenSymbol) {
        name = tokenName;
        symbol = tokenSymbol;
        minter = msg.sender;
        _totalSupply = FHE.asEuint64(0);
        FHE.allowThis(_totalSupply);
    }

    function mint(address to, externalEuint64 encryptedAmount, bytes calldata inputProof) external {
        require(msg.sender == minter, "Only minter");
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);
        _balances[to] = FHE.add(_balances[to], amount);
        _totalSupply = FHE.add(_totalSupply, amount);
        FHE.allowThis(_balances[to]);
        FHE.allowThis(_totalSupply);
        FHE.allow(_balances[to], to);
    }

    function transfer(address to, externalEuint64 encryptedAmount, bytes calldata inputProof) external {
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);
        euint64 zero = FHE.asEuint64(0);
        euint64 allowedAmount = FHE.select(FHE.gte(_balances[msg.sender], amount), amount, zero);

        _balances[msg.sender] = FHE.sub(_balances[msg.sender], allowedAmount);
        _balances[to] = FHE.add(_balances[to], allowedAmount);
        FHE.allowThis(_balances[msg.sender]);
        FHE.allowThis(_balances[to]);
        FHE.allow(_balances[msg.sender], msg.sender);
        FHE.allow(_balances[to], to);

        emit Transfer(msg.sender, to);
    }

    function encryptedBalanceOf(address account) external view returns (euint64) {
        return _balances[account];
    }
}
