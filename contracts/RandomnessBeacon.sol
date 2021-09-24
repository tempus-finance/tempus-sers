// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBase.sol";
import "./IRandomnessBeacon.sol";

contract RandomnessBeacon is IRandomnessBeacon, VRFConsumerBase, Ownable {
    bytes32 immutable keyHash;
    uint256 immutable fee;

    uint256 public override lastTimestamp;
    uint256 public override lastResult;

    /**
     * These settings are specific to the chain, see https://docs.chain.link/docs/vrf-contracts/
     * @param _fee It is 18 decimals, so for Mainnet 2 * 10**18
     */
    constructor(
        address _vrfCoordinator,
        address _linkToken,
        bytes32 _keyHash,
        uint256 _fee
    ) VRFConsumerBase(_vrfCoordinator, _linkToken) {
        keyHash = _keyHash;
        fee = _fee;
    }

    /**
     * Requests randomness
     */
    function requestRandomness() external onlyOwner returns (bytes32 requestId) {
        require(LINK.balanceOf(address(this)) >= fee, "Insufficient LINK balance");
        return requestRandomness(keyHash, fee);
    }

    /**
     * Callback function used by VRF Coordinator
     */
    function fulfillRandomness(
        bytes32, /*requestId*/
        uint256 randomness
    ) internal override {
        lastResult = randomness;
        lastTimestamp = block.timestamp;
    }

    /**
     * Withdraw all LINK balance to the owner.
     */
    function withdrawLink() external onlyOwner {
        uint256 balance = LINK.balanceOf(address(this));
        require(LINK.transfer(owner(), balance));
    }
}
