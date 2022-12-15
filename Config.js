const networkConfig = {
    5: {
        name: "goerli",
        interval: 30,
        vrf2coordinator: "0x2ca8e0c643bde4c2e08ab1fa0da3401adad7734d",
        keyHash:
            "0x79d3d8832d904592c0bf9818b621522c988bb8b0c05cdc3b15aea1b6e8db0c15",
        subId: 6707,
        minimumRequestConfirmations: 3,
        callBackGasLimit: 500000,
    },
    31337: {
        name: "hardhat",
        interval: 30,
        keyHash:
            "0x79d3d8832d904592c0bf9818b621522c988bb8b0c05cdc3b15aea1b6e8db0c15",
        minimumRequestConfirmations: 1,
        callBackGasLimit: 500000,
    },
};

const developpementChains = ["hardhat", "localhost"];

module.exports = {
    networkConfig,
    developpementChains,
};
