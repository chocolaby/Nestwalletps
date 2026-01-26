// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/NestToken.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // Deploy NestToken
        NestToken token = new NestToken(
            "NestToken",
            "NEST", 
            18,
            1000000 // 1M tokens initial supply
        );

        console.log("NestToken deployed to:", address(token));
        console.log("Initial supply:", token.totalSupply());
        console.log("Deployer balance:", token.balanceOf(msg.sender));

        vm.stopBroadcast();
    }
}
