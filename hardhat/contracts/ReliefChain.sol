// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract ReliefChain is AccessControl, ReentrancyGuard {
    // Define roles
    bytes32 public constant VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE");
    bytes32 public constant ORGANIZER_ROLE = keccak256("ORGANIZER_ROLE");

    // Campaign details (hardcoded single campaign)
    string public campaignName = "Vietnam Disaster Relief 2026";
    address public immutable campaignOwner;

    // Struct for a reimbursement request
    struct Request {
        uint256 id;
        address payable organizer;
        uint256 amount;
        string evidenceCID;      // IPFS Content Identifier
        uint256 approvals;
        bool approved;
        bool paid;
        mapping(address => bool) hasVoted;
    }

    // State variables
    uint256 public nextRequestId;
    mapping(uint256 => Request) public requests;
    uint256 public totalDonations;

    // Events
    event DonationReceived(address indexed donor, uint256 amount, uint256 timestamp);
    event RequestSubmitted(uint256 indexed requestId, address indexed organizer, uint256 amount, string evidenceCID);
    event VoteCast(uint256 indexed requestId, address indexed validator, bool approved);
    event FundsReleased(uint256 indexed requestId, address indexed organizer, uint256 amount);
    event CampaignFundsWithdrawn(address indexed owner, uint256 amount);

    // Modifiers
    modifier onlyOrganizer() {
        require(hasRole(ORGANIZER_ROLE, msg.sender), "Caller is not an organizer");
        _;
    }

    modifier onlyValidator() {
        require(hasRole(VALIDATOR_ROLE, msg.sender), "Caller is not a validator");
        _;
    }

    // Constructor: Set up roles and hardcode validators and organizers
    constructor(
        address[] memory _validators,
        address[] memory _organizers
    ) {
        campaignOwner = msg.sender;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);

        // Assign validator roles
        for (uint256 i = 0; i < _validators.length; i++) {
            _grantRole(VALIDATOR_ROLE, _validators[i]);
        }

        // Assign organizer roles
        for (uint256 i = 0; i < _organizers.length; i++) {
            _grantRole(ORGANIZER_ROLE, _organizers[i]);
        }
    }

    // Donation function: Accept MATIC
    function donate() external payable {
        require(msg.value > 0, "Donation must be greater than 0");
        totalDonations += msg.value;
        emit DonationReceived(msg.sender, msg.value, block.timestamp);
    }

    // Organizer submits a request with IPFS evidence
    function submitRequest(uint256 _amount, string calldata _evidenceCID) external onlyOrganizer {
        require(_amount > 0, "Amount must be greater than 0");
        require(address(this).balance >= _amount, "Insufficient campaign balance");

        uint256 requestId = nextRequestId++;
        Request storage newRequest = requests[requestId];
        newRequest.id = requestId;
        newRequest.organizer = payable(msg.sender);
        newRequest.amount = _amount;
        newRequest.evidenceCID = _evidenceCID;
        newRequest.approvals = 0;
        newRequest.approved = false;
        newRequest.paid = false;

        emit RequestSubmitted(requestId, msg.sender, _amount, _evidenceCID);
    }

    // Validator votes on a request (2-of-3 threshold hardcoded)
    function voteOnRequest(uint256 _requestId, bool _approve) external onlyValidator {
        Request storage req = requests[_requestId];
        require(!req.paid, "Request already paid");
        require(!req.approved, "Request already approved");
        require(!req.hasVoted[msg.sender], "Validator already voted");

        req.hasVoted[msg.sender] = true;
        if (_approve) {
            req.approvals++;
            emit VoteCast(_requestId, msg.sender, true);
        } else {
            emit VoteCast(_requestId, msg.sender, false);
        }

        // Check for 2-of-3 threshold (assumes exactly 3 validators)
        if (req.approvals >= 2 && !req.approved) {
            req.approved = true;
        }
    }

    // Organizer claims funds after approval (automatic after approval threshold)
    function claimApprovedFunds(uint256 _requestId) external nonReentrant {
        Request storage req = requests[_requestId];
        require(msg.sender == req.organizer, "Only the organizer can claim");
        require(req.approved, "Request not approved yet");
        require(!req.paid, "Already paid");

        req.paid = true;
        (bool sent, ) = req.organizer.call{value: req.amount}("");
        require(sent, "Failed to send funds");

        emit FundsReleased(_requestId, req.organizer, req.amount);
    }

    // Admin function to withdraw remaining funds after campaign ends (owner only)
    function withdrawRemaining() external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        payable(campaignOwner).transfer(balance);
        emit CampaignFundsWithdrawn(campaignOwner, balance);
    }

    // Fallback to receive direct donations
    receive() external payable {
        totalDonations += msg.value;
        emit DonationReceived(msg.sender, msg.value, block.timestamp);
    }

    // Helper to get request details (excluding mapping)
    function getRequestDetails(uint256 _requestId)
        external
        view
        returns (
            uint256 id,
            address organizer,
            uint256 amount,
            string memory evidenceCID,
            uint256 approvals,
            bool approved,
            bool paid
        )
    {
        Request storage req = requests[_requestId];
        return (
            req.id,
            req.organizer,
            req.amount,
            req.evidenceCID,
            req.approvals,
            req.approved,
            req.paid
        );
    }

    // Helper to check if a validator has voted
    function hasValidatorVoted(uint256 _requestId, address _validator) external view returns (bool) {
        return requests[_requestId].hasVoted[_validator];
    }
}