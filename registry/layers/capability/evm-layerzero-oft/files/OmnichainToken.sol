// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract {{contractName}} {
    mapping(address => uint256) private balances;

    constructor() {
        balances[msg.sender] = 1_000_000 ether;
    }

    function balanceOf(address account) external view returns (uint256) {
        return balances[account];
    }

    function sendTokens(uint32 destinationChain, address recipient, uint256 amount) external returns (bytes32 messageId) {
        require(balances[msg.sender] >= amount, "insufficient balance");
        balances[msg.sender] -= amount;
        balances[recipient] += amount;
        return keccak256(abi.encode(destinationChain, recipient, amount));
    }
}
