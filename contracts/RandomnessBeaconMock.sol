// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./IRandomnessBeacon.sol";

contract RandomnessBeaconMock is IRandomnessBeacon, Ownable {
    uint256 public override lastTimestamp;
    uint256 public override lastResult;

    function setResult(uint256 result) external onlyOwner {
        lastResult = result;
        lastTimestamp = block.timestamp;
    }
}
