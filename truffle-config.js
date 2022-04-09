const HDWalletProvider = require("@truffle/hdwallet-provider");
require("dotenv").config();


function createProviderForOpenEthereum(url) {
    let provider;
    const Web3WsProvider = require("web3-providers-ws");
    if (url.startsWith("ws:") || url.startsWith("wss:")) {
        provider = new Web3WsProvider(url);
        // apply the skipCache hack
        const origSend = provider.__proto__.send;
        provider.__proto__.send = function (payload, callback) {
            delete payload.skipCache;
            origSend.call(provider, payload, callback);
        };
    } else {
        // let hdwallet provider handle the url directly
        provider = url;
    }
    return provider;
}

module.exports = {

  networks: {

    rinkeby: {
      provider: () =>
      new HDWalletProvider(
        process.env.RINKEBY_MNEMONIC,
        process.env.RINKEBY_PROVIDER_URL,
        0, //address_index
        10, // num_addresses
        true // shareNonce
      ),
      network_id: 4,
      gas: 8e6,
      gasPrice: 1e9, // default 1 gwei
    },

    ganache: {
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
  },
  api_keys: {
    etherscan: process.env.ETHERSCAN_API_KEY
  }
};
