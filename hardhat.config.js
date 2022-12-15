/** @type import('hardhat/config').HardhatUserConfig */

require("@nomicfoundation/hardhat-chai-matchers");
require("solidity-coverage");
require("chai");
require("hardhat-deploy");
require("dotenv").config();
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-etherscan");

const GOERLI_URL = process.env.GOERLI_URL;
const PRIVATE_KEY1 = process.env.PRIVATE_KEY1;
const PRIVATE_KEY2 = process.env.PRIVATE_KEY2;
const ETHERSCAN_APIKEY = process.env.ETHERSCAN_APIKEY;

module.exports = {
    solidity: "0.8.17",
    networks: {
        hardhat: {
            chainId: 31337,
        },
    },
    networks: {
        hardhat: {
            chainId: 31337,
        },
        goerli: {
            chainId: 5,
            url: GOERLI_URL,
            accounts: [PRIVATE_KEY1, PRIVATE_KEY2],
        },
    },
    namedAccounts: {
        deployer: {
            default: 0,
        },
        helper: {
            default: 1,
        },
    },
    etherscan: {
        apiKey: ETHERSCAN_APIKEY,
    },
    mocha: {
        timeout: 100000000,
    },
};
