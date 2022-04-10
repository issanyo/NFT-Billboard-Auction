const { web3tx, toWad, toBN } = require("@decentral.ee/web3-helpers");
const { expectRevert, expectEvent } = require("@openzeppelin/test-helpers");
const deployFramework = require("@superfluid-finance/ethereum-contracts/scripts/deploy-framework");
const deployTestToken = require("@superfluid-finance/ethereum-contracts/scripts/deploy-test-token");
const deploySuperToken = require("@superfluid-finance/ethereum-contracts/scripts/deploy-super-token");
const SuperfluidSDK = require("@superfluid-finance/js-sdk");
const Auction = artifacts.require("Auction");
const traveler = require("ganache-time-traveler");

const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers").constants;
const TEST_TRAVEL_TIME = 3600 * 24; // 24 hours

contract("Auction", accounts => {
  const errorHandler = err => {
    if (err) throw err;
  };

  accounts = accounts.slice(0,10);
  const [admin, bob, carol, dan, alice, karl, anna, ben, john, dude] = accounts;
  const userNames = {};
  userNames[admin] = "Admin";
  userNames[bob] = "Bob";
  userNames[carol] = "Carol";
  userNames[dan] = "Dan";
  userNames[alice] = "Alice";
  userNames[karl] = "Karl";
  userNames[anna] = "Anna";
  userNames[ben] = "Ben";
  userNames[john] = "John";
  userNames[dude] = "Dude";

  process.env.RESET_SUPERFLUID_FRAMEWORK = true;
  process.env.NEW_TEST_RESOLVER  = true;

  let sf;
  let dai;
  let daix;
  let app;

  async function timeTravelOnce(time) {
    const _time = time || TEST_TRAVEL_TIME;
    const block1 = await web3.eth.getBlock("latest");
    console.log("current block time", block1.timestamp);
    console.log(`time traveler going to the future +${_time}...`);
    await traveler.advanceTimeAndBlock(_time);
    const block2 = await web3.eth.getBlock("latest");
    console.log("new block time", block2.timestamp);
  }

  async function joinAuction(account, flowRate) {
    const tx = await sf.cfa.createFlow({
      superToken: daix.address,
      sender: account,
      receiver: app.address,
      flowRate: flowRate,
      userData: ""
    });
    const block = await web3.eth.getBlock("latest");
    let obj = {};
    obj = await sf.cfa.getFlow({
      superToken: daix.address,
      sender: account,
      receiver: app.address
    });
    obj.account = account;
    obj.blockNumber = tx.receipt.blockNumber;
    obj.timestamp = toBN(block.timestamp);
    return obj;
  }

  async function updateAuction(account, flowRate) {
    const previousPlayerAddress = (await getPreviousPlayer(account)).account;
    let userData;
    if (previousPlayerAddress !== undefined) {
      userData = await web3.eth.abi.encodeParameters(
        ["address"],
        [previousPlayerAddress]
      );
    }

    const tx = await sf.cfa.updateFlow({
      superToken: daix.address,
      sender: account,
      receiver: app.address,
      flowRate: flowRate,
      userData: userData
    });
    const block = await web3.eth.getBlock("latest");
    let obj = {};
    obj = await sf.cfa.getFlow({
      superToken: daix.address,
      sender: account,
      receiver: app.address
    });
    obj.account = account;
    obj.blockNumber = tx.receipt.blockNumber;
    obj.timestamp = toBN(block.timestamp);
    return obj;
  }

  async function dropAuction(account) {
    let obj = {};
    const tx = await sf.cfa.deleteFlow({
      superToken: daix.address,
      sender: account,
      receiver: app.address
    });
    const block = await web3.eth.getBlock("latest");
    obj = await sf.cfa.getFlow({
      superToken: daix.address,
      sender: account,
      receiver: app.address
    });
    obj.account = account;
    obj.blockNumber = tx.receipt.blockNumber;
    obj.timestamp = toBN(block.timestamp);
    return obj;
  }

  async function flowFromAuctionTo(account) {
    return await sf.cfa.getFlow({
      superToken: daix.address,
      sender: app.address,
      receiver: account
    });

  }

  async function getFlowFromAuction(account) {
    return await getFlow(app.address, account);
  }

  async function dropStream(sender, receiver, by) {
    await sf.cfa.deleteFlow({
      superToken: daix.address,
      sender: sender,
      receiver: receiver,
      by: by
    });

    return await sf.cfa.getFlow({
      superToken: daix.address,
      sender: sender,
      receiver: receiver
    });
  }

  async function startStream(sender, receiver, flowRate) {
    await sf.cfa.createFlow({
      superToken: daix.address,
      sender: sender,
      receiver: receiver,
      flowRate: flowRate
    });

    return await sf.cfa.getFlow({
      superToken: daix.address,
      sender: sender,
      receiver: receiver
    });
  }

  async function getFlowFromUser(account) {
    return await getFlow(account, app.address);
  }

  async function getFlow(sender, receiver) {
    return await sf.cfa.getFlow({
      superToken: daix.address,
      sender: sender,
      receiver: receiver
    });
  }

  async function getListTop100() {
    return await viewer.getBiddersAddresses(app.address, 0, 100);
  }

  async function getPlayerPositionUnfiltered(account) {
    const scoreboard = await getListTop100();
    for (let i = 0; i < scoreboard.length; i++) {
      if (scoreboard[i].account == account) {
        return i;
      }
    }
    return 0;
  }

  async function getPreviousPlayerUnfiltered(account) {
    const pos = await getPlayerPositionUnfiltered(account);
    return pos == 0 ? ZERO_ADDRESS : (await getListTop100())[pos - 1];
  }

  async function getPlayerPosition(account) {
    const scoreboard = await getListTop100();

    const top = scoreboard.filter(item => item.flowRate > 0);

    for (let i = 0; i < top.length; i++) {
      if (top[i].account == account) {
        return i + 1;
      }
    }
    return 0;
  }

  async function checkPosition(account, scoreboardPosition) {
    return scoreboardPosition == 0
      ? false
      : (await getPlayerPosition(account)) == scoreboardPosition;
  }

  async function getPreviousPlayer(account) {
    const pos = await getPlayerPosition(account);
    return pos == 1 ? ZERO_ADDRESS : (await getListTop100())[pos - 2];
  }

  async function assertNoWinner() {
    const winner = await app.winner.call();
    const winnerFlowRate = await app.winnerFlowRate.call();
    assert.equal(winner, ZERO_ADDRESS, "no one should be the winner");
    assert.equal(
      winnerFlowRate.toString(),
      "0",
      "should not flowRate as winner"
    );
  }

  async function assertUserWinner(flowInfo) {
    const winner = await app.winner.call();
    const winnerFlowRate = await app.winnerFlowRate.call();
    assert.equal(
      winner,
      flowInfo.account,
      `${userNames[flowInfo.account]} should be the winner`
    );
    assert.equal(
      winnerFlowRate.toString(),
      flowInfo.flowRate.toString(),
      `${
        userNames[flowInfo.account]
      } should have the correct flowRate as winner`
    );
    const auctionFlow = await getFlowFromAuction(flowInfo.account);
    assert.equal(
      auctionFlow.flowRate,
      0,
      userNames[flowInfo.account] + " as winner, should not receive flow from auction"
    );
  }

  async function assertUserNonWinner(flowInfo) {
    const winner = await app.winner.call();
    const winnerFlowRate = await app.winnerFlowRate.call();
    assert.notEqual(
      winner,
      flowInfo.account,
      `${userNames[flowInfo.account]} should not be the winner`
    );
    assert.notEqual(
      winnerFlowRate.toString(),
      flowInfo.flowRate.toString(),
      `${
        userNames[flowInfo.account]
      } should not have the correct flowRate as winner`
    );
    const auctionFlow = await getFlowFromAuction(flowInfo.account);
    assert.equal(
      flowInfo.flowRate,
      auctionFlow.flowRate,
      userNames[flowInfo.account] + " as non winner should receive the same flow"
    );
  }

  async function assertTablePositions(orderUsers) {
    for (let i = 0; i < orderUsers.length; i++) {
      assert.ok(
        await checkPosition(orderUsers[i], i + 1),
        `${userNames[orderUsers[i]]} not in right place listTop`
      );
    }
  }

  async function assertCumulativeTime(users, time) {
    assert.equal(users.length, time.length, "Users and Time should be order");
    for(i=0; i< users.length; i++) {
      let result = await app.bidders(users[i]);
      assert.equal(result.cumulativeTimer.toString(), time[i].toString(), userNames[users[i]] + " Cumulative time should be the same");
    }
  }

  async function assertCumulativeBalance(users, balances) {
    assert.equal(users.length, balances.length, "Users and Time should be order");
    for(i=0; i< users.length; i++) {
      let result = await app.bidders(users[i]);
      assert.equal(result.lastSettleAmount.toString(), balances[i].toString(), userNames[users[i]] + " Cumulative Balance should be the same");
    }
  }

  async function printBiddersInfo() {
    console.log("================ User State ================");
    for(usr of accounts) {
      let data = await app.bidders(usr);
      console.log(userNames[usr] + " Balance " + data.lastSettleAmount.toString() + " Time " + data.cumulativeTimer.toString());
    }
    console.log("================ ///////// ================");
  }
  beforeEach(async function() {

    await deployFramework(errorHandler, { web3: web3, from: admin });
    await deployTestToken(errorHandler, [":", "fDAI"], {
      web3: web3,
      from: admin
    });
    await deploySuperToken(errorHandler, [":", "fDAI"], {
      web3: web3,
      from: admin
    });

    sf = new SuperfluidSDK.Framework({
      web3: web3,
      tokens: ["fDAI"]
    });

    await sf.initialize();
    daix = sf.tokens.fDAIx;
    //if (!dai) {
      const daiAddress = await sf.tokens.fDAI.address;
      dai = await sf.contracts.TestToken.at(daiAddress);
      for (let i = 0; i < accounts.length; ++i) {
        await web3tx(dai.mint, `Account ${i} mints many dai`)(
          accounts[i],
          toWad(10000000),
          { from: accounts[i] }
        );
        await web3tx(dai.approve, `Account ${i} approves daix`)(
          daix.address,
          toWad(100),
          { from: accounts[i] }
        );

        await web3tx(daix.upgrade, `Account ${i} upgrades many DAIx`)(
          toWad(100),
          { from: accounts[i] }
        );
      }
    //}
    app = await web3tx(Auction.new, "Deploy Auction")(
      sf.host.address,
      sf.agreements.cfa.address,
      daix.address,
      "0x00F96712cd4995bCd8647dd9Baa995286e4d5c99", //Fake
      99, //Fake
      86400,
      10,
      ""
    );
  });

  afterEach(async function() {
    assert.ok(!(await sf.host.isAppJailed(app.address)), "App is Jailed");
    await printBiddersInfo();
  });


  it("Case #0 - Check deployment", async() => {

    await expectRevert(Auction.new(
      ZERO_ADDRESS,
      //sf.host.address,
      sf.agreements.cfa.address,
      daix.address,
      "0x00F96712cd4995bCd8647dd9Baa995286e4d5c99", //Fake
      99, //Fake
      86400,
      10,
      ""
    ), "Auction: host is empty");

    await expectRevert(Auction.new(
      sf.host.address,
      ZERO_ADDRESS,
      //sf.agreements.cfa.address,
      daix.address,
      "0x00F96712cd4995bCd8647dd9Baa995286e4d5c99", //Fake
      99, //Fake
      86400,
      10,
      ""
    ), "Auction: cfa is empty");

    await expectRevert(Auction.new(
      sf.host.address,
      sf.agreements.cfa.address,
      ZERO_ADDRESS,
      //daix.address,
      "0x00F96712cd4995bCd8647dd9Baa995286e4d5c99", //Fake
      99, //Fake
      86400,
      10,
      ""
    ), "Auction: superToken is empty");

    await expectRevert(Auction.new(
      sf.host.address,
      sf.agreements.cfa.address,
      daix.address,
      ZERO_ADDRESS,
      99, //Fake
      86400,
      10,
      ""
    ), "Auction: NFT contract is empty");

    await expectRevert(Auction.new(
      sf.host.address,
      sf.agreements.cfa.address,
      daix.address,
      "0x00F96712cd4995bCd8647dd9Baa995286e4d5c99", //Fake
      99, //Fake
      0,
      10,
      ""
    ), "Auction: Provide a winner stream time");

    await expectRevert(Auction.new(
      sf.host.address,
      sf.agreements.cfa.address,
      daix.address,
      "0x00F96712cd4995bCd8647dd9Baa995286e4d5c99", //Fake
      99, //Fake
      86400,
      101,
      ""
    ), "Auction: Step value wrong");

  });

  //Auctions new players

  it("Player joins a new auction - should be winner", async () => {
    const bobFlowInfo = await joinAuction(bob, "10000000");
    await assertUserWinner(bobFlowInfo);
    await assertTablePositions([bob]);
  });

  it("New player bid is higher than previous bid + step", async () => {
    const stepAmount = await app.step();
    await joinAuction(bob, "10000000");
    await joinAuction(alice, toBN(10000000).mul(stepAmount));
    await assertTablePositions([alice, bob]);
  });

  it("New player bid is revert if not higher than previous bid + step", async () => {
    await joinAuction(bob, "10000000");
    await expectRevert(joinAuction(alice, 999999), "Auction: FlowRate is not enough")
    await assertTablePositions([bob]);
  });

  it("After leaving player can't rejoin auction", async () => {
    await joinAuction(bob, "10000000");
    await timeTravelOnce(3600);
    await dropAuction(bob);
    await expectRevert(joinAuction(bob, "10000"), "Auction: sorry no rejoins");
  });

  it("New players entering running auction - last player should be new winner", async () => {
    const bobFlowInfo = await joinAuction(bob, "10000000");
    const carolFlowInfo = await joinAuction(carol, "1100000001");
    await assertUserWinner(carolFlowInfo);
    await assertUserNonWinner(bobFlowInfo)
    await assertTablePositions([carol, bob]);
    const danFlowInfo = await joinAuction(dan, "5100000000");
    await assertUserWinner(danFlowInfo);
    await assertUserNonWinner(carolFlowInfo);
    await assertUserNonWinner(bobFlowInfo);
    await assertTablePositions([dan, carol, bob]);
    const aliceFlowInfo = await joinAuction(alice, "5900000000");
    await assertUserNonWinner(danFlowInfo);
    await assertUserNonWinner(carolFlowInfo);
    await assertUserNonWinner(bobFlowInfo);
    await assertUserWinner(aliceFlowInfo);
    await assertTablePositions([alice, dan, carol, bob]);
  });

  it("Winner don't have stream from auction", async () => {
    const bobFlowInfo = await joinAuction(bob, "10000000");
    await assertUserWinner(bobFlowInfo);
    await assertTablePositions([bob]);
  });

  it("Non winner get stream from auction with the same flowRate as bid", async () => {
    const bobFlowInfo = await joinAuction(bob, "10000000");
    const carolFlowInfo = await joinAuction(carol, "1100000001");
    await assertUserWinner(carolFlowInfo, "carol");
    await assertTablePositions([carol, bob]);
    const danFlowInfo = await joinAuction(dan, "5100000000");
    await assertUserWinner(danFlowInfo);
    await assertUserNonWinner(carolFlowInfo);
    await assertUserNonWinner(bobFlowInfo);
    await assertTablePositions([dan, carol, bob]);
  });

  it("Second player update to be winner", async () => {
    let bobFlowInfo = await joinAuction(bob, "10000000");
    let carolFlowInfo = await joinAuction(carol, "1100000001");
    await assertUserWinner(carolFlowInfo);
    await assertUserNonWinner(bobFlowInfo);
    bobFlowInfo = await updateAuction(bob, "51100000001")
    await assertUserWinner(bobFlowInfo);
    await assertTablePositions([bob, carol]);
  });

  it("Swap players in auction (swap elements on list) - should maintain correct list of player positions", async () => {
    let bobFlowInfo = await joinAuction(bob, "10000000");
    let carolFlowInfo = await joinAuction(carol, "1100000001");
    let danFlowInfo = await joinAuction(dan, "5100000000");
    let aliceFlowInfo = await joinAuction(alice, "5800000000");
    await assertUserNonWinner(bobFlowInfo);
    await assertUserNonWinner(carolFlowInfo);
    await assertUserNonWinner(danFlowInfo);
    await assertUserWinner(aliceFlowInfo);
    await assertTablePositions([alice, dan, carol, bob]);
    //Bob from last to top
    await timeTravelOnce(1800);
    bobFlowInfo = await updateAuction(bob, "6850000000");
    await assertUserWinner(bobFlowInfo);
    await assertUserNonWinner(carolFlowInfo);
    await assertUserNonWinner(danFlowInfo);
    await assertUserNonWinner(aliceFlowInfo);
    await assertTablePositions([bob, alice, dan, carol]);
    //Alice from second to top
    aliceFlowInfo = await updateAuction(alice, "7850000000");
    await assertUserNonWinner(bobFlowInfo);
    await assertUserNonWinner(carolFlowInfo);
    await assertUserNonWinner(danFlowInfo);
    await assertUserWinner(aliceFlowInfo);
    await assertTablePositions([alice, bob, dan, carol]);
    //Carol third to top
    carolFlowInfo = await updateAuction(carol, "18154200000");
    await assertUserNonWinner(bobFlowInfo);
    await assertUserWinner(carolFlowInfo);
    await assertUserNonWinner(danFlowInfo);
    await assertUserNonWinner(aliceFlowInfo);
    await assertTablePositions([carol, alice, bob, dan]);
  });

});
