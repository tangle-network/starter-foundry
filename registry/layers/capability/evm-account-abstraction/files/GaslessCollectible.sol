// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract {{contractName}} {
    string public baseURI;
    uint256 public nextTokenId = 1;
    mapping(uint256 => address) private owners;

    constructor(string memory initialBaseURI) {
        baseURI = initialBaseURI;
    }

    function mint(address recipient) external returns (uint256 tokenId) {
        tokenId = nextTokenId++;
        owners[tokenId] = recipient;
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        return owners[tokenId];
    }
}
