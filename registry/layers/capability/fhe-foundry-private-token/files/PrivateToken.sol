// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {FHE, euint32, InEuint32} from "@fhenixprotocol/cofhe-contracts/FHE.sol";

/// @title PrivateToken
/// @notice ERC20-like token with encrypted balances and encrypted transfer gates.
contract PrivateToken {
    string public name;
    string public symbol;
    address public minter;

    mapping(address => euint32) private _balances;
    euint32 private _totalSupply;

    event Transfer(address indexed from, address indexed to);

    constructor(string memory tokenName, string memory tokenSymbol) {
        name = tokenName;
        symbol = tokenSymbol;
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
        euint32 zero = FHE.asEuint32(0);
        euint32 allowedAmount = FHE.select(FHE.gte(_balances[msg.sender], amount), amount, zero);

        _balances[msg.sender] = FHE.sub(_balances[msg.sender], allowedAmount);
        _balances[to] = FHE.add(_balances[to], allowedAmount);
        FHE.allowThis(_balances[msg.sender]);
        FHE.allowThis(_balances[to]);
        FHE.allow(_balances[msg.sender], msg.sender);
        FHE.allow(_balances[to], to);

        emit Transfer(msg.sender, to);
    }

    function encryptedBalanceOf(address account) external view returns (euint32) {
        return _balances[account];
    }

    function encryptedTotalSupply() external view returns (euint32) {
        return _totalSupply;
    }
}
