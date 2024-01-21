const { network } = require("hardhat")
const { ethers, parseUnits } = require("ethers")
const { developmentChains, networkConfig } = require("../helper-hardhat-config")

//From https://docs.chain.link/vrf/v2/subscription/supported-networks
const BASE_FEE = parseUnits("0.25", "ether") //ethers.parseEther("0.25") //0.25 is the cost in LINK
const GAS_PRICE_LINK = 1e9
//These two value up here are need from the VRFCoordinatorV2Mock contract

module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    //const chainId = network.config.chainId
    const args = [BASE_FEE, GAS_PRICE_LINK]

    if (developmentChains.includes(network.name)) {
        //is the network that we are presently running in the developmentChains list
        log("Local Network detected! Deploying Mocks ...")

        //deploy a mock for vrfCoordinator ...
        await deploy("VRFCoordinatorV2Mock", {
            from: deployer,
            log: true,
            args: args,
        })
        log("Mocks deployed")
        log("----------------------------------------")
    }
}

module.exports.tags = ["all", "mocks"]
