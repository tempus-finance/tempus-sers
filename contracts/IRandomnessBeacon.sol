// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

interface IRandomnessBeacon {
    function lastTimestamp() external returns (uint256);

    function lastResult() external returns (uint256);
}
