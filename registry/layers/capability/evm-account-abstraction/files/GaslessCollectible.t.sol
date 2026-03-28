// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { {{contractName}} } from "../src/{{contractName}}.sol";

contract {{contractName}}Test {
    {{contractName}} internal collectible;

    function setUp() public {
        collectible = new {{contractName}}("ipfs://collection/");
    }

    function test_mint_assigns_owner() public {
        uint256 tokenId = collectible.mint(address(0xCAFE));
        assert(collectible.ownerOf(tokenId) == address(0xCAFE));
    }
}
