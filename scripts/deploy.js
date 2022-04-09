const Auction = artifacts.require("Auction");

module.exports = async function (callback, argv) {

    try {

        const host = "0x"; //ISuperfluid host
        const cfa = "0x"; // IConstantFlowAgreementV1
        const daoToken = "0x";
        const NFT = "0x";

        let app;

        for(let i = 0; i < 5; i++) {

            app = await Auction.new(
                host,
                cfa,
                daoToken,
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
