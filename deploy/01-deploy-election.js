const { network, ethers } = require("hardhat");
const { networkConfig, developpementChains } = require("../Config.js");
const { verify } = require("../utils/verify.js");

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();

    const CHAINID = network.config.chainId;
    const KEYHASH = networkConfig[CHAINID]["keyHash"];
    const MINIMUM_REQUEST_CONFIRMATIONS =
        networkConfig[CHAINID]["minimumRequestConfirmations"];

    let vrfCoordinator_address, subId, VRFCoordinatorV2Mock;

    if (developpementChains.includes(network.name.toLowerCase())) {
        VRFCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock");
        vrfCoordinator_address = VRFCoordinatorV2Mock.address;
        const tx = await VRFCoordinatorV2Mock.createSubscription();
        const tr = await tx.wait("1");
        subId = tr.events[0].args.subId;
    } else {
        vrfCoordinator_address = networkConfig[CHAINID]["vrf2coordinator"];
        subId = networkConfig[CHAINID]["subId"];
    }

    const duration = networkConfig[CHAINID]["interval"];
    const callBackGasLimit = networkConfig[CHAINID]["callBackGasLimit"];

    /*
        uint256 duration,
        address _vrfCoordinator,
        bytes32 _keyHash,
        uint64 _subId,
        uint16 _minimumRequestConfirmations,
        uint32 _callbackGasLimit
    */

    const arguments = [
        duration,
        vrfCoordinator_address,
        KEYHASH,
        subId,
        MINIMUM_REQUEST_CONFIRMATIONS,
        callBackGasLimit,
    ];

    await deploy("Election", {
        from: deployer,
        log: true,
        args: arguments,
    });

    if (developpementChains.includes(network.name.toLowerCase())) {
        let Election = await ethers.getContract("Election", deployer);
        await VRFCoordinatorV2Mock.addConsumer(subId, Election.address);
        await VRFCoordinatorV2Mock.fundSubscription(
            subId,
            "26000000000000000000" // BASE FEE + 1000000000000000000
        );
    } else {
        let Election = await ethers.getContract("Election", deployer);
        await verify(Election.address, arguments);
    }
    console.log("--------------------------------------\n");
};

module.exports.tags = ["all"];
