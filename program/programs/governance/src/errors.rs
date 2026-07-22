use anchor_lang::error_code;

#[error_code]
pub enum GovernanceError {
    #[msg("Already initialized")]
    AlreadyInitialized,
    #[msg("Not initialized")]
    NotInitialized,
    #[msg("Unauthorized access")]
    Unauthorized,
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
    #[msg("Proposal not found")]
    ProposalNotFound,
    #[msg("Proposal not in voting state")]
    ProposalNotVoting,
    #[msg("Proposal already executed")]
    ProposalAlreadyExecuted,
    #[msg("Proposal already cancelled")]
    ProposalAlreadyCancelled,
    #[msg("Proposal has expired")]
    ProposalExpired,
    #[msg("Voting period has not ended")]
    VotingPeriodNotEnded,
    #[msg("Already voted on this proposal")]
    AlreadyVoted,
    #[msg("Minimum voting power not met")]
    InsufficientVotingPower,
    #[msg("Proposal did not pass")]
    ProposalDidNotPass,
    #[msg("Quorum not reached")]
    QuorumNotReached,
    #[msg("Member not found")]
    MemberNotFound,
    #[msg("Member already registered")]
    MemberAlreadyRegistered,
    #[msg("Description too long")]
    DescriptionTooLong,
    #[msg("URI too long")]
    UriTooLong,
}
