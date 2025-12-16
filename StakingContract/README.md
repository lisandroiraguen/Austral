# Austral Staking Smart Contracts

This repository contains the Aiken smart contracts for the Austral Staking system.
The system is built on **Plutus V3** standards and allows users to lock ADA for a fixed period and receive rewards in a native token (`Austral-Test`).

## Core Validators

### 1. `staking.ak`
This contract manages individual user deposits.

**Features:**
*   **Time Lock:** Funds are locked until a specific `release_time`.
*   **Beneficiary Check:** Only the designated beneficiary can withdraw the funds.
*   **Reward Claim:** Successful withdrawals usually require the payout to include both the original Principal ADA and the accrued Reward Tokens.
*   **Refund Mechanism (New):** If rewards are unavailable, users can trigger a `Refund` to withdraw *only* their Principal ADA (after the time lock expires).

**Redeemers:**
*   `Claim`: Withdraw Principal + Rewards.
*   `Refund`: Withdraw Principal only.

### 2. `treasury.ak`
This contract holds the Reward Tokens and is controlled by the project owner.

**Features:**
*   **Owner Control:** The treasury funds are secured by the owner's signature.
*   **Reward Distribution:** Used to fund the user's withdrawal transaction with the necessary reward tokens.

## Deployment

The contracts are compiled using Aiken.

```sh
aiken build
```

## Testing

Run the test suite to verify the logic, including the new Refund path:

```sh
aiken check
```

## Security Considerations

*   **Fund Safety:** The `Refund` mechanism ensures that users' ADA is never permanently locked due to a lack of reward tokens in the Treasury.
*   **Address Matching:** The contract strictly matches the beneficiary's payment credential. Ensure your wallet interaction scripts construct the address correctly.
