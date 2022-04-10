const HDWalletProvider = require("@truffle/hdwallet-provider");
require("dotenv").config();

module.exports = {

  networks: {

    ropsten: {
      provider: () => new HDWalletProvider(process.env.ROPSTEN_MNEMONIC, process.env.ROPSTEN_PROVIDER_URL),
      network_id: 3,
      gas: 8e6,
      gasPrice: 1e9, // default 1 gwei
    },

    development: {
      host: "localhost",
      port: 8545,
      network_id: "*"
    },

  },

  compilers: {
    solc: {
      version: "0.7.6",
       settings: {
        optimizer: {
          enabled: true,
          runs: 200
        },
       }
    },
  }
};
