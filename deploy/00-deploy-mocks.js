const { network, ethers } = require("hardhat");
const { developpementChains } = require("../Config");

const BASE_FEE = "25000000000000000000";
const GAS_PRICE = "1000000000";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deployer } = await getNamedAccounts();
    const { deploy, log } = deployments;

    const arguments = [BASE_FEE, GAS_PRICE];

    if (developpementChains.includes(network.name.toLowerCase())) {
        console.log("Deploying mocks...");
        await deploy("VRFCoordinatorV2Mock", {
            from: deployer,
            log: true,
            args: arguments,
        });
    }

    console.log("--------------------------------------\n");
};

module.exports.tags = ["all", "mock"];
