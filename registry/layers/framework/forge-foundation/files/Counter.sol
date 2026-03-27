// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract {{contractName}} {
    uint256 private value;

    function set(uint256 newValue) external {
        value = newValue;
    }

    function get() external view returns (uint256) {
        return value;
    }
}
