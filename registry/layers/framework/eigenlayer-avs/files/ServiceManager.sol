// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ServiceManager {
    string public constant SERVICE_NAME = "{{avsName}}";

    function latestStatus() external pure returns (string memory) {
        return "registered";
    }
}
