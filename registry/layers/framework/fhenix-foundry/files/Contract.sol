// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {FHE, euint32, ebool, InEuint32} from "@fhenixprotocol/cofhe-contracts/FHE.sol";

/// @title {{contractName}}
/// @notice Fhenix FHE contract. State is held as ENCRYPTED types (euint*/ebool)
///         and only ever touched through FHE.* ops — never decrypted on-chain
///         except through an authorized seal/permit. This is the real artifact:
///         replace the placeholder logic below with the product's encrypted flow
///         (sealed-bid auction, private vote, confidential balance, etc).
contract {{contractName}} {
    /// Encrypted state. Stays a ciphertext handle for its whole lifetime.
    euint32 internal _value;
    address public owner;

    constructor() {
        owner = msg.sender;
        // Trivially-encrypt the initial value, then authorize THIS contract to
        // keep operating on the resulting ciphertext across calls.
        _value = FHE.asEuint32(0);
        FHE.allowThis(_value);
    }

    /// @notice Fold an encrypted input into encrypted state. The caller encrypts
    ///         `amount` client-side via cofhejs and submits the sealed handle —
    ///         the plaintext never touches the chain.
    /// @dev    TODO: replace this counter fold with the product's real encrypted
    ///         logic (bid comparison via FHE.gte + FHE.select, vote tally via
    ///         FHE.add, etc). The shape — decrypt input → FHE op → re-authorize —
    ///         is the load-bearing pattern.
    function submit(InEuint32 calldata amount) external {
        euint32 incoming = FHE.asEuint32(amount);
        _value = FHE.add(_value, incoming);
        FHE.allowThis(_value);
        FHE.allowSender(_value); // let the caller seal/decrypt their own view
    }

    /// @notice An encrypted comparison the off-chain client can seal and read.
    /// @dev    Returns an `ebool` ciphertext — NOT a plaintext bool — so the
    ///         comparison result itself stays private until sealed for an
    ///         authorized viewer.
    function isAtLeast(InEuint32 calldata threshold) external returns (ebool result) {
        euint32 t = FHE.asEuint32(threshold);
        result = FHE.gte(_value, t);
        FHE.allowThis(result);
        FHE.allowSender(result);
    }

    /// @notice Return the encrypted state handle. The caller seals it client-side
    ///         (cofhejs unseal) — the contract never exposes plaintext.
    function encryptedValue() external view returns (euint32) {
        return _value;
    }
}
