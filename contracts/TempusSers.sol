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

    bytes32 private constant CLAIMSER_TYPEHASH =
        keccak256("ClaimSer(address recipient,uint256 batch,uint256 ticketId)");

    /// The next batch which is yet to be issued.
    uint256 public nextBatch;

    /// The supply in each batch.
    mapping(uint256 => uint256) public batchSupply;

    /// The base URI for the collection.
    mapping(uint256 => string) public baseTokenURIs;

    /// The commitment to the base URI.
    mapping(uint256 => bytes32) public baseTokenURICommitments;

    /// The seed used for the shuffling.
    mapping(uint256 => uint32) public shuffleSeeds;

    /// The map of tickets (per batch) which have been claimed already.
    mapping(uint256 => mapping(uint256 => bool)) public claimedTickets;

    /// The original minter of a given token.
    mapping(uint256 => address) public originalMinter;

    constructor() ERC721("Tempus Sers", "SERS") EIP712("Tempus Sers", "1") {}

    function totalAvailableSupply() private view returns (uint256 ret) {
        for (uint256 i = 0; i < nextBatch; i++) {
            ret += batchSupply[i];
        }
    }

    /// Returns the token ID offset for any given batch.
    function tokenBatchOffset(uint256 batch) private view returns (uint256 ret) {
        assert(batch < nextBatch);
        for (uint256 i = 0; i < batch; i++) {
            ret += batchSupply[i];
        }
    }

    function addBatch(
        uint256 batch,
        bytes32 uriCommitment,
        uint256 supply
    ) external onlyOwner {
        require(nextBatch == batch, "TempusSers: Invalid batch");
        require((totalAvailableSupply() + supply) <= MAX_SUPPLY, "TempusSers: Supply will exceed maximum");
        require((uriCommitment != 0) && (uriCommitment != keccak256("")), "TempusSers: URI cannot be empty");

        baseTokenURICommitments[batch] = uriCommitment;
        batchSupply[batch] = supply;

        nextBatch++;
    }

    function revealBatch(uint256 batch, string calldata _baseTokenURI) external onlyOwner {
        require(shuffleSeeds[batch] != 0, "TempusSers: Seed not set yet");
        require(bytes(baseTokenURIs[batch]).length == 0, "TempusSers: Collection already revealed");
        require(keccak256(bytes(_baseTokenURI)) == baseTokenURICommitments[batch], "TempusSers: Commitment mismatch");

        baseTokenURIs[batch] = sanitizeBaseURI(_baseTokenURI);
    }

    function setSeed(uint256 batch) external onlyOwner {
        require(shuffleSeeds[batch] == 0, "TempusSers: Seed already set");

        // TODO: set it with proper source of randomness
        shuffleSeeds[batch] = uint32(uint256(blockhash(block.number - 1)));
    }

    function redeemTicket(
        address recipient,
        uint256 batch,
        uint256 ticketId,
        bytes memory signature
    ) external {
        require(bytes(baseTokenURIs[batch]).length != 0, "TempusSers: Collection not revealed yet");

        // This is a short-cut for avoiding double claiming tickets.
        require(!claimedTickets[batch][ticketId], "TempusSers: Ticket already claimed");
        require(ticketId < MAX_SUPPLY, "TempusSers: Invalid ticket id");

        // Check validity of claim
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(CLAIMSER_TYPEHASH, recipient, batch, ticketId)));
        require(SignatureChecker.isValidSignatureNow(owner(), digest, signature), "TempusSers: Invalid signature");

        // Claim ticket.
        claimedTickets[batch][ticketId] = true;

        uint256 tokenId = ticketToTokenId(batch, ticketId);

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
        uint256 batch = tokenIdToBatch(tokenId);

        require(bytes(baseTokenURIs[batch]).length != 0, "TempusSers: Collection not revealed yet");

        // ipfs://Qmd6FJksU1TaRkVhTiDZLqG4yi4Hg5NCXFD6QiF9zEgZSs/1.json
        return string(bytes.concat(bytes(baseTokenURIs[batch]), bytes(Strings.toString(tokenId)), bytes(".json")));
    }

    function ticketToTokenId(uint256 batch, uint256 ticketId) public view returns (uint256) {
        require(shuffleSeeds[batch] != 0, "TempusSers: Seed not set yet");
        uint256 rawTokenId = uint256(
            Shuffle.permute(SafeCast.toUint32(ticketId), uint32(batchSupply[batch]), shuffleSeeds[batch])
        );
        return batchToTokenId(batch, rawTokenId);
        //        return tokenBatchOffset(batch) + rawTokenId;
    }

    function batchToTokenId(uint256 batch, uint256 tokenId) private pure returns (uint256) {
        return (batch << 16) | tokenId;
    }

    function tokenIdToBatch(uint256 tokenId) private pure returns (uint256) {
        return tokenId >> 16;
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
