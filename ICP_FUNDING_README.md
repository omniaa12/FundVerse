# FundVerse ICP Funding Integration

This document describes the ICP coin funding functionality that has been added to the FundVerse platform.

## Overview

The FundVerse platform now supports ICP coin funding through two main canisters:

1. **Fund_Flow Canister** - Handles ICP transfers, escrow, and contribution management
2. **FundVerse_backend Canister** - Manages campaigns, ideas, and integrates with Fund_Flow

## Architecture

```
User -> Fund_Flow.contribute_icp() -> ICP Ledger -> Fund_Flow.confirm_payment() -> FundVerse_backend.receive_icp_contribution()
```

## Key Features

### 1. ICP Coin Funding
- Users can contribute ICP coins directly to campaigns
- All amounts are tracked in e8s (ICP's smallest unit)
- Transfers are recorded and verified through the ICP ledger

### 2. Escrow System
- Contributions start as "Pending"
- After confirmation, they become "Held" in escrow
- When campaign ends successfully, funds are "Released" to project owners
- If campaign fails, funds are "Refunded" to backers

### 3. Campaign Integration
- Campaign amounts are automatically updated when ICP contributions are received
- Total funding includes both ICP and traditional payment methods
- Campaign metadata is shared between canisters for validation

## API Reference

### Fund_Flow Canister

#### User Registration
```rust
register_user(name: String, email: String) -> Result<(), String>
is_registered(p: Option<Principal>) -> bool
get_my_profile() -> Option<RegisteredUser>
```

#### ICP Contributions
```rust
contribute_icp(backend: Principal, campaign_id: u64, amount_e8s: u64) -> Result<u64, String>
confirm_payment(contribution_id: u64, backend: Principal) -> Result<(), String>
```

#### Campaign Management
```rust
release_campaign(backend: Principal, campaign_id: u64) -> Result<u64, String>
refund_campaign(campaign_id: u64) -> Result<u64, String>
```

#### Queries
```rust
get_contributions_by_user(p: Option<Principal>) -> Vec<Contribution>
get_campaign_contributions(campaign_id: u64) -> Vec<Contribution>
get_escrow_summary(campaign_id: u64) -> EscrowSummary
get_icp_transfer(transfer_id: u64) -> Option<ICPTransfer>
```

### FundVerse_backend Canister

#### Fund_Flow Integration
```rust
get_campaign_meta(campaign_id: u64) -> Option<CampaignMeta>
receive_icp_contribution(campaign_id: u64, amount_e8s: u64) -> Result<(), String>
receive_payout(campaign_id: u64, total_amount: u64) -> Result<(), String>
get_icp_contribution(campaign_id: u64) -> u64
get_campaign_total_funding(campaign_id: u64) -> u64
```

## Usage Flow

### 1. User Registration
```bash
# Register a user
dfx canister call Fund_Flow register_user '("John Doe", "john@example.com")'
```

### 2. Create Campaign
```bash
# Create an idea first
dfx canister call FundVerse_backend create_idea '("My Project", "Description", 1000000, "Legal Entity", "contact@example.com", "technology", 1)'

# Create a campaign
dfx canister call FundVerse_backend create_campaign '(1, 1000000, 1735689600)'
```

### 3. Contribute ICP
```bash
# Contribute 1 ICP (100,000,000 e8s) to campaign 1
dfx canister call Fund_Flow contribute_icp '(principal "your-backend-canister-id", 1, 100000000)'
```

### 4. Confirm Payment
```bash
# Confirm the contribution (simulates payment confirmation)
dfx canister call Fund_Flow confirm_payment '(1, principal "your-backend-canister-id")'
```

### 5. Check Status
```bash
# Get campaign total funding
dfx canister call FundVerse_backend get_campaign_total_funding '(1)'

# Get escrow summary
dfx canister call Fund_Flow get_escrow_summary '(1)'
```

## Data Types

### Contribution
```rust
pub struct Contribution {
    pub id: u64,
    pub campaign_id: u64,
    pub backer: Principal,
    pub amount: u64,            // e8s for ICP
    pub method: PaymentMethod,
    pub status: EscrowStatus,
    pub created_at_ns: u64,
    pub confirmed_at_ns: Option<u64>,
    pub icp_transfer_id: Option<u64>,
}
```

### ICPTransfer
```rust
pub struct ICPTransfer {
    pub id: u64,
    pub from: Principal,
    pub to: Principal,
    pub amount_e8s: u64,
    pub memo: u64,              // campaign_id
    pub block_height: Option<u64>,
    pub status: ICPTransferStatus,
    pub created_at_ns: u64,
    pub confirmed_at_ns: Option<u64>,
}
```

## Security Considerations

1. **Access Control**: Only registered users can contribute
2. **Campaign Validation**: Contributions are validated against campaign existence and end dates
3. **Escrow Protection**: Funds are held in escrow until campaign completion
4. **Transfer Verification**: ICP transfers are verified through the ledger

## Future Enhancements

1. **Real ICP Ledger Integration**: Replace simulation with actual ledger calls
2. **Multi-token Support**: Add support for other tokens (SNS, etc.)
3. **Advanced Escrow**: Add time-locked releases and milestone-based payouts
4. **Analytics**: Add contribution analytics and reporting
5. **Notifications**: Add real-time notifications for contribution events

## Testing

To test the ICP funding functionality:

1. Start local replica: `dfx start --background --clean`
2. Deploy canisters: `dfx deploy`
3. Register users and create test campaigns
4. Make ICP contributions and verify the flow
5. Test escrow release and refund scenarios

## Notes

- Current implementation simulates ICP transfers for testing
- Real ledger integration requires proper ICP ledger canister setup
- All amounts are in e8s (ICP's smallest unit: 1 ICP = 100,000,000 e8s)
- The system supports both ICP and traditional payment methods simultaneously
