// ReedemableNFT, where a curator can issue a redeemable cheque for minting a given token.
//
// The message to be signed is an EIP-712 compatible structured data:
//   struct RedeemableNFT {
//       address recipient;
//       uint256 tokenId;
//   }
//
// This message can then signed by the curator and given to the user who submits it.
// The validity of the signature is checked according to EIP-1271 if the signer is a contract,
// or via a regular signature check otherwise.
//
// See: https://eips.ethereum.org/EIPS/eip-712 and https://eips.ethereum.org/EIPS/eip-1271
//
// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";

contract TempusSers is ERC721Enumerable, EIP712, Ownable {
    /// Total supply of sers.
    uint256 public constant MAX_SUPPLY = 11111;

    bytes32 private constant CLAIMSER_TYPEHASH = keccak256("ClaimSer(address recipient, uint256 ticketId)");

    /// The base URI for the collection.
    string public baseTokenURI;

    /// The map of tickets which have been claimed already.
    mapping(uint256 => bool) public claimedTickets;

    /// The original minter of a given token.
    mapping(uint256 => address) public originalMinter;

    constructor(string memory _baseTokenURI) ERC721("Tempus Sers", "SERS") EIP712("Tempus Sers", "1") {
        baseTokenURI = _baseTokenURI;
    }

    function redeemTicket(address recipient, uint256 ticketId, bytes memory signature) external {
        // This is a short-cut for avoiding double claiming tickets.
        require(claimedTickets[ticketId] == false, "TempusSer: Ticket already claimed");

        // Check validity of claim
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(
            CLAIMSER_TYPEHASH,
            recipient,
            ticketId
        )));
        require(SignatureChecker.isValidSignatureNow(owner(), digest, signature), "TempusSers: Invalid signature");

        claimedTickets[ticketId] = true;

        uint256 tokenId = findNextToken(recipient);
        assert(tokenId < MAX_SUPPLY);

        _mintToUser(recipient, tokenId);
    }

    function _mintToUser(address recipient, uint256 tokenId) private {
        // Sanity check
        assert(totalSupply() < MAX_SUPPLY);

        // Mark who was the original owner
        originalMinter[tokenId] = recipient;

        _safeMint(recipient, tokenId);
    }

    function findNextToken(address recipient) private view returns (uint256 tokenId) {
        do {
            tokenId = uint256(keccak256(abi.encode(tokenId, recipient))) % MAX_SUPPLY;
        } while (_exists(tokenId));
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        // ifpfs://Qmd6FJksU1TaRkVhTiDZLqG4yi4Hg5NCXFD6QiF9zEgZSs/1.json2
        return string(bytes.concat(
            bytes(baseTokenURI),
            bytes(Strings.toString(tokenId)),
            bytes(".json")
        ));
    }
}
