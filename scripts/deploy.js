const Auction = artifacts.require("Auction");
const deploySuperToken = require("@superfluid-finance/ethereum-contracts/scripts/deploy-super-token");

module.exports = async function (callback, argv) {

    try {
        const daoToken = "0x9f235C8d5BEfee9Bb077E56dCde32c9bAe2F4180";
        await deploySuperToken(err => {if (err) throw err;}, [":", daoToken]);

        const host = "0x"; //ISuperfluid host
        const cfa = "0x"; // IConstantFlowAgreementV1
        const superDaoToken = "0x";
        const NFT = "0x";

        let app;

        for(let i = 0; i < 5; i++) {

            app = await Auction.new(
                host,
                cfa,
                superDaoToken,
                NFT,
                1,
                3600,
                1
            );

            console.log("App deployed at", app.address);
        }
    } catch (err) {
        console.log(err);
    }
}
