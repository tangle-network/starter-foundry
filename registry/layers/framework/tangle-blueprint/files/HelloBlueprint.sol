// SPDX-License-Identifier: UNLICENSE
pragma solidity >=0.8.26;

import "tnt-core/src/BlueprintServiceManagerBase.sol";

/// @title {{blueprintName}}
/// @dev Service blueprint providing job handlers on Tangle.
contract {{blueprintName}} is BlueprintServiceManagerBase {
    function onRegister(
        address operator,
        bytes calldata registrationInputs
    ) external payable virtual override onlyFromTangle {}

    function onRequest(
        uint64 serviceId,
        address requester,
        address[] calldata operators,
        bytes calldata requestInputs,
        uint64 ttl,
        address paymentAsset,
        uint256 amount
    ) external payable virtual override onlyFromTangle {}

    function onJobResult(
        uint64 serviceId,
        uint8 job,
        uint64 jobCallId,
        address operator,
        bytes calldata inputs,
        bytes calldata outputs
    ) external payable virtual override onlyFromTangle {}
}
