// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.9.0;

interface IRandomnessBeacon {
    function lastTimestamp() external returns (uint256);

    function lastResult() external returns (uint256);
}
