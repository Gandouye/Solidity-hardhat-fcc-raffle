//require("@nomicfoundation/hardhat-toolbox")
require("@nomicfoundation/hardhat-verify")
require("@nomicfoundation/hardhat-chai-matchers")
require("hardhat-deploy")
require("solidity-coverage")
require("hardhat-gas-reporter")
require("hardhat-contract-sizer")
require("@nomicfoundation/hardhat-ethers")
//require("@nomiclabs/hardhat-waffle")
require("dotenv").config()

/** @type import('hardhat/config').HardhatUserConfig */

const SEPOLIA_RPC_URL = process.env.RPC_URL_SEPOLIA
const SEPOLIA_PRIVATE_KEY = process.env.PRIVATE_KEY_SEPOLIA
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY
const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY

module.exports = {
    defaultNetwork: "hardhat",
    networks: {
        sepolia: {
            url: SEPOLIA_RPC_URL,
            accounts: SEPOLIA_PRIVATE_KEY !== undefined ? [SEPOLIA_PRIVATE_KEY] : [],
            gasPrice: 10000000000,
            saveDeployments: true,
            chainId: 11155111,
        },
        localhost: {
            url: "http://127.0.0.1:8545/",
            chainId: 31337,
        },
    },
    solidity: {
        compilers: [{ version: "0.8.19" }, { version: "0.8.0" }, { version: "0.8.4" }],
    },
    namedAccounts: {
        deployer: {
            default: 0,
        },
        player: {
            default: 1,
        },
    },
    etherscan: {
        // Your API key for Etherscan
        // Obtain one at https://etherscan.io/
        apiKey: {
            sepolia: [ETHERSCAN_API_KEY],
        },
    },
    mocha: {
        setTimeout: 400000,
        timeout: 400000,
    },
}
