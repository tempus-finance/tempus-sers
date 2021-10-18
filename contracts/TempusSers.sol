// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";

import "./Shuffle.sol";

contract TempusSers is ERC721Enumerable, Ownable {
    /// Opensea specific event to mark metadata as frozen
    event PermanentURI(string _value, uint256 indexed _id);

    /// Total supply of sers.
    uint256 public constant MAX_SUPPLY = 3333;

    /// The base URI for the collection.
    string public baseTokenURI;

    /// The merkle root of the claim list.
    bytes32 public claimlistRoot;

    /// The seed used for the shuffling.
    uint32 public shuffleSeed;

    /// The map of tickets which have been claimed already.
    mapping(uint256 => bool) public claimedTickets;

    /// The original minter of a given token.
    mapping(uint256 => address) public originalMinter;

    constructor(string memory _baseTokenURI, bytes32 _claimlistRoot) ERC721("Tempus Sers", "SERS") {
        baseTokenURI = sanitizeBaseURI(_baseTokenURI);
        claimlistRoot = _claimlistRoot;
    }

    function setSeed() external onlyOwner {
        require(shuffleSeed == 0, "TempusSers: Seed already set");

        // TODO: set it with proper source of randomness
        shuffleSeed = uint32(uint256(blockhash(block.number - 1)));
    }

    function proveTicket(
        address recipient,
        uint256 ticketId,
        bytes32[] calldata proof
    ) external {
        // This is a short-cut for avoiding double claiming tickets.
        require(!claimedTickets[ticketId], "TempusSers: Ticket already claimed");
        require(ticketId > 0 && ticketId <= MAX_SUPPLY, "TempusSers: Invalid ticket id");

        require(recipient != address(0), "TempusSers: Invalid recipient");

        bytes32 leaf = keccak256(abi.encode(recipient, ticketId));
        require(MerkleProof.verify(proof, claimlistRoot, leaf), "TempusSers: Invalid proof");

        // Claim ticket.
        claimedTickets[ticketId] = true;

        _mintToUser(recipient, ticketToTokenId(ticketId));
    }

    function _mintToUser(address recipient, uint256 tokenId) private {
        assert(totalSupply() < MAX_SUPPLY);

        // Mark who was the original owner
        originalMinter[tokenId] = recipient;

        _safeMint(recipient, tokenId);

        emit PermanentURI(tokenURI(tokenId), tokenId);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        // ipfs://Qmd6FJksU1TaRkVhTiDZLqG4yi4Hg5NCXFD6QiF9zEgZSs/1.json
        return string(bytes.concat(bytes(baseTokenURI), bytes(Strings.toString(tokenId)), bytes(".json")));
    }

    function ticketToTokenId(uint256 ticketId) public view returns (uint256) {
        require(shuffleSeed != 0, "TempusSers: Seed not set yet");
        return uint256(Shuffle.permute(SafeCast.toUint32(ticketId - 1), uint32(MAX_SUPPLY), shuffleSeed));
    }

    /// Sanitize the input URI so that it always end with a forward slash.
    ///
    /// Note that we assume the URI is ASCII, and we ignore the case of empty URI.
    function sanitizeBaseURI(string memory uri) private pure returns (string memory) {
        bytes memory tmp = bytes(uri);
        require(tmp.length != 0, "TempusSers: URI cannot be empty");
        if (tmp[tmp.length - 1] != "/") {
            return string(bytes.concat(tmp, "/"));
        }
        return uri;
    }
}
