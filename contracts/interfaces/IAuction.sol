pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

import {
    ISuperToken
} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol";

import {
    IConstantFlowAgreementV1
} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/agreements/IConstantFlowAgreementV1.sol";

interface  IAuction {

    event NewHighestBid(address indexed account, int96 flowRate);
    event DropPlayer(address indexed account);
    event Winner(address indexed account);
    event AuctionClosed();

    function _cfa() external view returns (IConstantFlowAgreementV1);
    function _superToken() external view returns(ISuperToken);
    function step() external view returns(int96);
    function winner() external view returns(address);
    function isFinish() external view returns(bool);
    function winnerFlowRate() external view returns(int96);
    function streamTime() external view returns(uint256);
    function lastTick() external view returns(uint256);
    function bidders(address account) external view returns(uint256 cumulativeTimer, uint256 lastSettleAmount, address nextAccount);
    function getSettledInfo(address account) external view returns(uint256 settleBalance,uint256 cumulativeTimer);
}
