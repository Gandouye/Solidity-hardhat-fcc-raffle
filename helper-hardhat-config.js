//const { ethers } = require("hardhat")
const { ethers, parseUnits } = require("ethers")

const networkConfig = {
    default: {
        name: "hardhat",
        keepersUpdateInterval: "30",
    },
    11155111: {
        name: "sepolia",
        //https://docs.chain.link/vrf/v2/subscription/supported-networks
        vrfCoordinatorV2: "0x8103B0A8A00be2DDC778e6e7eaa21791Cd364625",
        entranceFee: parseUnits("0.01", "ether"),
        gasLane: "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c",
        keepersUpdateInterval: "30",
        subscriptionId: "8558",
        callbackGasLimit: "1000000",
        interval: "30",
    },
    31337: {
        name: "localhost",
        entranceFee: parseUnits("0.01", "ether"),
        gasLane: "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c", //will not be used
        keepersUpdateInterval: "30",
        subscriptionId: "588",
        callbackGasLimit: "500000",
        interval: "30",
    },
    1: {
        name: "mainnet",
        keepersUpdateInterval: "30",
    },
}
const developmentChains = ["hardhat", "localhost"]
const VERIFICATION_BLOCK_CONFIRMATIONS = 6

module.exports = {
    networkConfig,
    developmentChains,
    VERIFICATION_BLOCK_CONFIRMATIONS,
}
