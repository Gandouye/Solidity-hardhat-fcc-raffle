// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/vrf/VRFConsumerBaseV2.sol";
//import "@chainlink/contracts/src/v0.8/shared/access/ConfirmedOwner.sol";
import "@chainlink/contracts/src/v0.8/automation/interfaces/AutomationCompatibleInterface.sol";
//import "hardhat/console.sol";

error Raffle__NotEnoughETHEntered();
error Raffle__TransferFailed();
error Raffle__NotOpen();
error Raffle_UpKeepNotNeeded(uint256 currentBalance, uint256 numPlayers, uint256 raffleState);

contract Raffle is VRFConsumerBaseV2, AutomationCompatibleInterface {
    /* Type declaration */
    enum RaffleState {
        OPEN,
        CALCULATING
    } //it is a uint256 where 0=OPENN, 1=CALCULATING

    //State variables
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    bytes32 private immutable i_gasLane;
    uint64 private immutable i_subscriptionId;
    uint32 private immutable i_callBackGasLimit;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private constant NUM_WORDS = 1;

    //Lottery variables
    uint256 private immutable i_entranceFee;
    address payable[] private s_players;
    address private s_recentWinner;
    RaffleState private s_raffleState;
    uint256 private s_lastTimeStamp;
    uint256 private immutable i_interval;

    //Events
    event RaffleEnter(address indexed player);
    event RequestedRaffleWinner(uint256 indexed requestId);
    event WinnerPicked(address indexed winner);

    constructor(
        address vrfCoordinatorV2,
        uint256 entranceFee,
        bytes32 gasLane,
        uint64 subscriptionId,
        uint32 callBackGasLimit,
        uint256 interval
    ) VRFConsumerBaseV2(vrfCoordinatorV2) {
        i_entranceFee = entranceFee;
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        i_gasLane = gasLane;
        i_subscriptionId = subscriptionId;
        i_callBackGasLimit = callBackGasLimit;
        s_raffleState = RaffleState.OPEN; //same as RaffleState(0)
        s_lastTimeStamp = block.timestamp; // initialized with current block timestamp
        i_interval = interval;
    }

    function enterRaffle() public payable {
        //require minimum amount tranfered
        if (msg.value < i_entranceFee) {
            revert Raffle__NotEnoughETHEntered();
        }
        if (s_raffleState != RaffleState.OPEN) {
            revert Raffle__NotOpen();
        }
        s_players.push(payable(msg.sender));

        // Emit an Event when we update a dynamic array or mapping
        emit RaffleEnter(msg.sender);
    }

    /**
     * @dev This is the function that ChainLink keeper nodes call
     * they look for the 'upKeepNeed' to return true
     * The following should be true in order to return true
     * 1. The time interval should be paased
     * 2. The lottery have at least one player and some ETH
     * 3. Our subscription is funded with LINK (money of ChainLink)
     * 4. Lottery should be in an "Open" state
     */
    function checkUpkeep(
        bytes memory /* checkData */
    ) public view override returns (bool upkeepNeeded, bytes memory /* performData */) {
        bool isOpen = (RaffleState.OPEN == s_raffleState);
        bool timePassed = ((block.timestamp - (s_lastTimeStamp)) > (i_interval));
        bool hasPlayers = (s_players.length > 0);
        bool hasBalance = (address(this).balance > 0);
        upkeepNeeded = (isOpen && timePassed && hasPlayers && hasBalance);
        return (upkeepNeeded, "0x0"); // can we comment this out?
    }

    //function performUpkeep(bytes calldata performData) external

    function performUpkeep(bytes calldata /* performData */) external override {
        (bool upKeepNeeded, ) = checkUpkeep("0x0");
        if (!upKeepNeeded) {
            revert Raffle_UpKeepNotNeeded(
                address(this).balance,
                s_players.length,
                uint256(s_raffleState)
            );
        }
        s_raffleState = RaffleState.CALCULATING;
        uint256 requestedId = i_vrfCoordinator.requestRandomWords(
            i_gasLane,
            i_subscriptionId,
            REQUEST_CONFIRMATIONS,
            i_callBackGasLimit,
            NUM_WORDS
        );
        emit RequestedRaffleWinner(requestedId);
    }

    function fulfillRandomWords(
        uint256 /* requestId */,
        uint256[] memory randomWords
    ) internal override {
        uint256 indexOfWinner = randomWords[0] % s_players.length; //Modulo operator
        address payable recentWinner = s_players[indexOfWinner];
        s_recentWinner = recentWinner;
        s_raffleState = RaffleState.OPEN;
        s_players = new address payable[](0); //Resetting the s_player array
        s_lastTimeStamp = block.timestamp;
        (bool success, ) = recentWinner.call{value: address(this).balance}("");
        if (!success) {
            revert Raffle__TransferFailed();
        }
        emit WinnerPicked(recentWinner);
    }

    //View / Pure Functions
    function getEntranceFee() public view returns (uint256) {
        return i_entranceFee;
    }

    function getPlayer(uint256 index) public view returns (address) {
        return s_players[index];
    }

    function getRecentWinner() public view returns (address) {
        return s_recentWinner;
    }

    function getRaffleState() public view returns (RaffleState) {
        return s_raffleState;
    }

    function getNumWords() public pure returns (uint256) {
        //pure because NUM_WORDS is in the byteCode not in the storage
        return NUM_WORDS;
    }

    function getNumberOfPlayers() public view returns (uint256) {
        return s_players.length;
    }

    function getLatestTimeStamp() public view returns (uint256) {
        return s_lastTimeStamp;
    }

    function getRequestsConfirmation() public pure returns (uint256) {
        return REQUEST_CONFIRMATIONS;
    }

    function getInterval() public view returns (uint256) {
        return i_interval;
    }
}
