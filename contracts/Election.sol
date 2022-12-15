//SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

error Election_has_already_voted();
error Election_candidate_not_a_candidate();
error Election_already_a_candidate();
error Election_closed();
error Election_not_owner();
error Election_fullfillRandomWords_not_called_yet();
error Election_not_time_yet();
error Election_no_winning_candidate();

import "@chainlink/contracts/src/v0.8/AutomationCompatible.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";

contract Election is AutomationCompatibleInterface, VRFConsumerBaseV2 {
    event Election_end(address indexed winner, uint256 indexed votes);
    event RandomWordsRequested(uint256 indexed requestId);

    enum state {
        open,
        close
    }

    state private s_electionState;
    uint256 private s_topVotes;
    mapping(address => uint256) private s_candidatetovotes;
    address[] private s_candidates;
    address[] private s_voters;
    address[] private s_WinningCandidates;
    mapping(address => bool) private s_voterhasvoted;
    uint256 private s_electionStart;
    uint256 private s_electionDuration;

    address private immutable i_owner;
    bytes32 private immutable i_keyHash;//gasLane
    uint64 private immutable i_subId;
    uint16 private immutable i_minimumRequestConfirmations;
    uint32 private immutable i_callbackGasLimit;
    VRFCoordinatorV2Interface private immutable i_coordinator;

    uint32 constant NUMWORDS = 1;

    modifier onlyOwner {
        if(msg.sender != i_owner)revert Election_not_owner();
            _;
    }
                  
    constructor(
        uint256 duration,
        address _vrfCoordinator,
        bytes32 _keyHash,
        uint64 _subId,
        uint16 _minimumRequestConfirmations,
        uint32 _callbackGasLimit
    ) VRFConsumerBaseV2(_vrfCoordinator) {
        s_topVotes = 0 ;
        i_owner = msg.sender;
        i_coordinator = VRFCoordinatorV2Interface(_vrfCoordinator);
        s_electionState = state.open;
        s_electionStart = block.timestamp;
        s_electionDuration = duration;
        i_subId = _subId;
        i_keyHash = _keyHash;
        i_callbackGasLimit = _callbackGasLimit;
        i_minimumRequestConfirmations =  _minimumRequestConfirmations;
    }

    function checkUpkeep(
        bytes calldata /*checkData*/
    )
        public
        view
        override
        returns (bool upkeepNeeded, bytes memory /*performData*/)
    {
        bool electionisopen = (s_electionState == state.open);
        bool WinningCandidatesNotEmpty = (s_WinningCandidates.length >= 1);
        bool electionfinished = (block.timestamp - s_electionStart >
            s_electionDuration);
        upkeepNeeded = (electionfinished &&
            electionisopen &&
            WinningCandidatesNotEmpty);
    }

    function performUpkeep(bytes calldata /*performData*/) external override {
        if(s_electionState == state.close)revert Election_closed();
        if(block.timestamp - s_electionStart < s_electionDuration)revert Election_not_time_yet();
        if(s_WinningCandidates.length == 0)revert Election_no_winning_candidate();
            s_electionState = state.close;
            if (s_WinningCandidates.length == 1) {
                address Winner = s_WinningCandidates[0];
                uint256 NumberOfvotes = s_topVotes;
                s_topVotes = 0;
                s_WinningCandidates = new address[](0);
                for(uint i = 0 ; i < s_candidates.length ; i++){
                    s_candidatetovotes[s_candidates[i]] = 0 ;
                }
                for(uint i = 0 ; i < s_voters.length ; i++){
                    s_voterhasvoted[s_voters[i]] = false ;
                }
                emit Election_end(Winner,NumberOfvotes);
            } else {
               uint256 requestId = i_coordinator.requestRandomWords(i_keyHash,i_subId,i_minimumRequestConfirmations,i_callbackGasLimit,NUMWORDS);
               emit RandomWordsRequested(requestId);
        }
    }

    function fulfillRandomWords(uint256 /*requestId*/, uint256[] memory randomWords) internal override{
          uint256 WinningNumberOfVotes = s_topVotes;
          address Winner = s_WinningCandidates[randomWords[0]%s_WinningCandidates.length];
          s_topVotes = 0;
          s_WinningCandidates = new address[](0);
          for(uint i = 0 ; i < s_candidates.length ; i++){
            s_candidatetovotes[s_candidates[i]] = 0 ;
          }
          for(uint i = 0 ; i < s_voters.length ; i++){
            s_voterhasvoted[s_voters[i]] = false ;
          }
          emit Election_end( Winner , WinningNumberOfVotes);  
    }

    function vote(address candidate) external {
        if (s_electionState == state.close) revert Election_closed();
        if (s_voterhasvoted[msg.sender]) revert Election_has_already_voted();
        if (s_candidatetovotes[candidate] == 0)
            revert Election_candidate_not_a_candidate();
        s_voterhasvoted[msg.sender] = true;
        s_voters.push(msg.sender);
        s_candidatetovotes[candidate]++;
        uint256 numberOfVotes = s_candidatetovotes[candidate];
        if (numberOfVotes > s_topVotes) {
            s_topVotes = numberOfVotes;
            delete s_WinningCandidates;
            s_WinningCandidates.push(candidate);
        } else {
            if (numberOfVotes == s_topVotes) {
                s_WinningCandidates.push(candidate);
            }
        }
    }

    function selfElect() external {
        if (s_electionState == state.close) revert Election_closed();
        if (s_candidatetovotes[msg.sender] >= 1)revert Election_already_a_candidate();
        s_candidates.push(msg.sender);
        s_voters.push(msg.sender);
        s_voterhasvoted[msg.sender] = true;
        s_candidatetovotes[msg.sender] = 1;
    }

    function Reset_Election(uint256 Duration) public onlyOwner{
        if(s_electionState == state.close && s_topVotes == 0 && s_WinningCandidates.length == 0){
            s_electionStart = block.timestamp;
            s_electionDuration = Duration;
            s_electionState = state.open;
        }else revert Election_fullfillRandomWords_not_called_yet();
    }

    function get_electionState() public view returns (state) {
        return s_electionState;
    }

    function get_topVotes() public view returns (uint256) {
        return s_topVotes;
    }

    function get_candidatetovotes(
        address candidate
    ) public view returns (uint256) {
        return s_candidatetovotes[candidate];
    }

    function get_voterhasvoted(address voter) public view returns (bool) {
        return s_voterhasvoted[voter];
    }

    function get_electionStart() public view returns (uint256) {
        return s_electionStart;
    }

    function get_electionDuration() public view returns (uint256) {
        return s_electionDuration;
    }

    function getCurrentTimestamp() public view returns (uint256) {
        return block.timestamp;
    }

    function getTimeLeft() public view returns (uint256) {
        uint256 TimeLeft = block.timestamp - s_electionStart;
        return TimeLeft < s_electionDuration ? TimeLeft : 0;
    }

    function get_candidates(uint256 index) public view returns(address){
        return s_candidates[index];
    }

     function get_voters(uint256 index) public view returns(address){
        return s_voters[index];
    }

    function get_owner() public view returns(address ){
        return i_owner;
    }

    function get_keyHash() public view returns(bytes32 ){
        return i_keyHash;
    }

    function get_subId() public view returns(uint64 ){
        return i_subId;
    }

    function get_minimumRequestConfirmations() public view returns(uint16 ){
        return i_minimumRequestConfirmations;
    }

    function get_callbackGasLimit() public view returns(uint32 ){
        return i_callbackGasLimit;
    }
    
    function get_coordinator() public view returns(VRFCoordinatorV2Interface ){
        return i_coordinator;
    }

    function get_WinningCandidates(uint256 index) public view returns(address){
        if(s_WinningCandidates.length-1 < index )revert Election_no_winning_candidate();
        return s_WinningCandidates[index];
    }

}