pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;


import {
    IToken
} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol";

import {
    IConstantFlowAgreementV1
} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/agreements/IConstantFlowAgreementV1.sol";

import {IAuction} from "./interfaces/IAuction.sol";

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/SignedSafeMath.sol";



contract AuctionViewer {

    using SafeMath for uint256;
    using SignedSafeMath for int256;

    event NewHighestBid(address indexed account, int96 flowRate);
    event DropPlayer(address indexed account);
    event Winner(address indexed account);
    event AuctionClosed();

    function getCFAContract(address auctionAddress)
    public
    view
    returns(address)
    {
        return address(IAuction(auctionAddress)._cfa());
    }

    function getTokenAddress(address auctionAddress)
    public
    view
    returns(address)
    {
        return address(IAuction(auctionAddress)._superToken());
    }


    function getStep(address auctionAddress)
    public
    view
    returns(int96)
    {
        return IAuction(auctionAddress).step();
    }

    function getStreamTime(address auctionAddress)
    public
    view
    returns(uint256)
    {
        return IAuction(auctionAddress).streamTime();
    }

    function isFinish(address auctionAddress)
    public
    view
    returns(bool)
    {
        return IAuction(auctionAddress).isFinish();
    }

    function isWinningConditionMeet(IAuction a) external view returns (bool) {
        address winner = a.winner();
        if (winner != address(0)) {
            (uint256 cumulativeTimer, ,) = a.bidders(winner);
            uint256 lastTick = a.lastTick();
            uint256 streamTime = a.streamTime();
            return cumulativeTimer.add(
                block.timestamp.sub(lastTick)
                ) >= streamTime;
        } else {
            return false;
        }
    }


    function getBiddersAddresses(
        address auctionAddress,
        uint256 listFrom,
        uint256 listTo
    )
    public
    view
    returns(IAuction.ViewBidder[100] memory top)
    {

        IAuction auction = IAuction(auctionAddress);
        address winner = auction.winner();

        if(winner == address(0)) {
            return top;
        }
        address _bidder = winner;
        uint256 j;
        top[0] = _getViewBidder(auctionAddress, winner);
        for(uint256 i = 0; i < 10000; i++) {
            if(i > listFrom && i < listTo) {
                j++;
                (, , _bidder) = auction.bidders(_bidder);
                if(_bidder == address(0)) {
                    return top;
                }
                top[j] = _getViewBidder(auctionAddress, _bidder);
            }
        }
    }


    function getViewBidder(address auctionAddress, address account) public view returns(IAuction.ViewBidder memory) {
        return _getViewBidder(auctionAddress, account);
    }

    function _getViewBidder(address auctionAddress, address account) private view returns(IAuction.ViewBidder memory) {
        IAuction auction = IAuction(auctionAddress);
        (, int96 flowRate) = _getFlowInfo(
            auction._cfa(),
            auction._superToken(),
            account,
            auctionAddress);

        uint256 timeToWin;
        (uint256 cumulativeTimer, uint256 lastSettleAmount, address nextAccount) = auction.bidders(account);
        uint256 time = cumulativeTimer;
        uint256 balance = lastSettleAmount;
        if(account == auction.winner()) {
            (uint256 _settleBalance, uint256 _cumulativeTimer) = auction.getSettledInfo(account);
            balance = lastSettleAmount.add(_settleBalance);
            time = cumulativeTimer.add(_cumulativeTimer);
        }
        if(time > auction.streamTime()) {
            timeToWin = 0;
        } else {
            timeToWin = auction.streamTime().sub(time);
        }
        return IAuction.ViewBidder(account, timeToWin, flowRate, balance, nextAccount);
    }

    function _getFlowInfo(
        IConstantFlowAgreementV1 _cfa,
        IToken _superToken,
        address sender,
        address auctionAddress
    )
    internal
    view
    returns (uint256 timestamp, int96 flowRate)
    {
        (timestamp, flowRate , ,) = _cfa.getFlow(_superToken, sender, auctionAddress);
    }
}
