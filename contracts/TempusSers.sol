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

import "./Shuffle.sol";

contract TempusSers is ERC721Enumerable, EIP712, Ownable {
    /// Opensea specific event to mark metadata as frozen
    event PermanentURI(string _value, uint256 indexed _id);

    /// Total supply of sers.
    uint256 public constant MAX_SUPPLY = 3333;

    bytes32 private constant CLAIMSER_TYPEHASH = keccak256("ClaimSer(address recipient,uint256 ticketId)");

    /// The base URI for the collection.
    string public baseTokenURI;

    /// The commitment to the base URI.
    bytes32 public baseTokenURICommitment;

    /// The seed used for the shuffling.
    uint32 public shuffleSeed;

    /// The map of tickets which have been claimed already.
    mapping(uint256 => bool) public claimedTickets;

    /// The original minter of a given token.
    mapping(uint256 => address) public originalMinter;

    constructor(bytes32 _baseTokenURICommitment) ERC721("Tempus Sers", "SERS") EIP712("Tempus Sers", "1") {
        require(
            (_baseTokenURICommitment != 0) && (_baseTokenURICommitment != keccak256("")),
            "TempusSers: URI cannot be empty"
        );

        baseTokenURICommitment = _baseTokenURICommitment;
    }

    function reveal(string calldata _baseTokenURI) external onlyOwner {
        require(shuffleSeed != 0, "TempusSers: Seed not set yet");
        require(bytes(baseTokenURI).length == 0, "TempusSers: Collection already revealed");
        require(keccak256(bytes(_baseTokenURI)) == baseTokenURICommitment, "TempusSers: Commitment mismatch");

        baseTokenURI = sanitizeBaseURI(_baseTokenURI);
    }

    function setSeed() external onlyOwner {
        require(shuffleSeed == 0, "TempusSers: Seed already set");

        // TODO: set it with proper source of randomness
        shuffleSeed = uint32(uint256(blockhash(block.number - 1)));
    }

    function redeemTicket(
        address recipient,
        uint256 ticketId,
        bytes memory signature
    ) external {
        require(bytes(baseTokenURI).length != 0, "TempusSers: Collection not revealed yet");

        // This is a short-cut for avoiding double claiming tickets.
        require(!claimedTickets[ticketId], "TempusSers: Ticket already claimed");
        require(ticketId < MAX_SUPPLY, "TempusSers: Invalid ticket id");

        // Check validity of claim
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(CLAIMSER_TYPEHASH, recipient, ticketId)));
        require(SignatureChecker.isValidSignatureNow(owner(), digest, signature), "TempusSers: Invalid signature");

        // Claim ticket.
        claimedTickets[ticketId] = true;

        uint256 tokenId = ticketToTokenId(ticketId);

        _mintToUser(recipient, tokenId);
    }

    function _mintToUser(address recipient, uint256 tokenId) private {
        assert(totalSupply() < MAX_SUPPLY);

        // Mark who was the original owner
        originalMinter[tokenId] = recipient;

        _safeMint(recipient, tokenId);

        emit PermanentURI(tokenURI(tokenId), tokenId);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(bytes(baseTokenURI).length != 0, "TempusSers: Collection not revealed yet");

        // ipfs://Qmd6FJksU1TaRkVhTiDZLqG4yi4Hg5NCXFD6QiF9zEgZSs/1.json
        return string(bytes.concat(bytes(baseTokenURI), bytes(Strings.toString(tokenId)), bytes(".json")));
    }

    function ticketToTokenId(uint256 ticketId) public view returns (uint256) {
        require(shuffleSeed != 0, "TempusSers: Seed not set yet");
        return uint256(Shuffle.permute(SafeCast.toUint32(ticketId), uint32(MAX_SUPPLY), shuffleSeed));
    }

    /// Sanitize the input URI so that it always end with a forward slash.
    ///
    /// Note that we assume the URI is ASCII, and we ignore the case of empty URI.
    function sanitizeBaseURI(string memory uri) private pure returns (string memory) {
        bytes memory tmp = bytes(uri);
        assert(tmp.length != 0);
        if (tmp[tmp.length - 1] != "/") {
            return string(bytes.concat(tmp, "/"));
        }
        return uri;
    }
}
