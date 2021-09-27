// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "./Shuffle.sol";

contract ShuffleTest {
    function permute(
        uint32 idx,
        uint32 len,
        uint32 seed
    ) external pure returns (uint32) {
        return Shuffle.permute(idx, len, seed);
    }
}
