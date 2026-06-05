// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

// Vendored minimal CoFHE contracts surface so the scaffold compiles OFFLINE
// under `forge build`. This mirrors the public @fhenixprotocol/cofhe-contracts
// API the agent writes against (encrypted types + FHE.* ops + permissions) but
// is NOT the production FHE coprocessor — the real package ships the host
// precompiles. On a real Fhenix deployment, install
// @fhenixprotocol/cofhe-contracts and point the remapping at it. Here it exists
// so the type checker and the build engage on the agent's own src/*.sol.
//
// Lives under lib/cofhe-contracts/contracts/ on purpose: that path is treated
// as a vendored third-party lib (it is NOT the agent's deliverable artifact),
// so the agent's src/<Name>.sol is the required real contract.

type euint8 is uint256;
type euint16 is uint256;
type euint32 is uint256;
type euint64 is uint256;
type euint128 is uint256;
type euint256 is uint256;
type ebool is uint256;
type eaddress is uint256;

struct InEuint8 { uint256 ctHash; uint8 securityZone; uint8 utype; bytes signature; }
struct InEuint16 { uint256 ctHash; uint8 securityZone; uint8 utype; bytes signature; }
struct InEuint32 { uint256 ctHash; uint8 securityZone; uint8 utype; bytes signature; }
struct InEuint64 { uint256 ctHash; uint8 securityZone; uint8 utype; bytes signature; }
struct InEuint128 { uint256 ctHash; uint8 securityZone; uint8 utype; bytes signature; }
struct InEuint256 { uint256 ctHash; uint8 securityZone; uint8 utype; bytes signature; }
struct InEbool { uint256 ctHash; uint8 securityZone; uint8 utype; bytes signature; }
struct InEaddress { uint256 ctHash; uint8 securityZone; uint8 utype; bytes signature; }

library FHE {
    // ─── trivial encryption (plaintext → ciphertext handle) ───
    function asEuint8(uint256 value) internal pure returns (euint8) { return euint8.wrap(value); }
    function asEuint16(uint256 value) internal pure returns (euint16) { return euint16.wrap(value); }
    function asEuint32(uint256 value) internal pure returns (euint32) { return euint32.wrap(value); }
    function asEuint64(uint256 value) internal pure returns (euint64) { return euint64.wrap(value); }
    function asEuint128(uint256 value) internal pure returns (euint128) { return euint128.wrap(value); }
    function asEuint256(uint256 value) internal pure returns (euint256) { return euint256.wrap(value); }
    function asEbool(bool value) internal pure returns (ebool) { return ebool.wrap(value ? 1 : 0); }
    function asEaddress(address value) internal pure returns (eaddress) { return eaddress.wrap(uint256(uint160(value))); }

    // ─── decrypt a sealed input handle into an in-contract ciphertext ───
    function asEuint8(InEuint8 memory value) internal pure returns (euint8) { return euint8.wrap(value.ctHash); }
    function asEuint16(InEuint16 memory value) internal pure returns (euint16) { return euint16.wrap(value.ctHash); }
    function asEuint32(InEuint32 memory value) internal pure returns (euint32) { return euint32.wrap(value.ctHash); }
    function asEuint64(InEuint64 memory value) internal pure returns (euint64) { return euint64.wrap(value.ctHash); }
    function asEuint128(InEuint128 memory value) internal pure returns (euint128) { return euint128.wrap(value.ctHash); }
    function asEuint256(InEuint256 memory value) internal pure returns (euint256) { return euint256.wrap(value.ctHash); }
    function asEbool(InEbool memory value) internal pure returns (ebool) { return ebool.wrap(value.ctHash); }
    function asEaddress(InEaddress memory value) internal pure returns (eaddress) { return eaddress.wrap(value.ctHash); }

    // ─── homomorphic arithmetic (euint32; extend per type as needed) ───
    function add(euint32 a, euint32 b) internal pure returns (euint32) {
        return euint32.wrap(euint32.unwrap(a) + euint32.unwrap(b));
    }
    function sub(euint32 a, euint32 b) internal pure returns (euint32) {
        return euint32.wrap(euint32.unwrap(a) - euint32.unwrap(b));
    }
    function mul(euint32 a, euint32 b) internal pure returns (euint32) {
        return euint32.wrap(euint32.unwrap(a) * euint32.unwrap(b));
    }

    // ─── homomorphic comparison → ebool ───
    function lte(euint32 a, euint32 b) internal pure returns (ebool) {
        return ebool.wrap(euint32.unwrap(a) <= euint32.unwrap(b) ? 1 : 0);
    }
    function gte(euint32 a, euint32 b) internal pure returns (ebool) {
        return ebool.wrap(euint32.unwrap(a) >= euint32.unwrap(b) ? 1 : 0);
    }
    function eq(euint32 a, euint32 b) internal pure returns (ebool) {
        return ebool.wrap(euint32.unwrap(a) == euint32.unwrap(b) ? 1 : 0);
    }

    // ─── oblivious selection (encrypted ternary) ───
    function select(ebool control, euint32 a, euint32 b) internal pure returns (euint32) {
        return ebool.unwrap(control) == 1 ? a : b;
    }

    // ─── access control: grant decryption/seal permission for a ciphertext ───
    function allowThis(euint32) internal pure {}
    function allowThis(ebool) internal pure {}
    function allow(euint32, address) internal pure {}
    function allow(ebool, address) internal pure {}
    function allowSender(euint32) internal pure {}
    function allowSender(ebool) internal pure {}

    // ─── seal an encrypted value for off-chain client-side decryption ───
    function sealoutput(euint32 value, bytes32) internal pure returns (string memory) {
        return string(abi.encodePacked(euint32.unwrap(value)));
    }
}
