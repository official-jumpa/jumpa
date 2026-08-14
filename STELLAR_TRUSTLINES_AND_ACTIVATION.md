# Stellar Account Activation & USDC Trustlines Guide

This document explains the technical architecture, protocol rules, and automated workflows for **Stellar Account Activation** and **USDC Trustline Management** within the Jumpa Telegram bot.

---

## 1. Executive Summary & Core Differences

Unlike Ethereum (EVM) or Solana—where any generated public key can immediately accept ERC-20 / SPL tokens—the **Stellar Blockchain Protocol** enforces two strict safety constraints:

1. **Account Activation (Base Reserve)**: A newly generated Stellar public key (`G...`) does not exist on the public ledger until it is funded with at least **1 XLM** (the base reserve).
2. **Trustlines (Token Opt-In)**: A Stellar account cannot receive or hold non-native assets (such as Circle's **USDC**) until it explicitly signs and submits an on-chain **`ChangeTrust` operation**.

---

## 2. Deep-Dive into Protocol Concepts

### A. Account Activation (`CreateAccount` vs `Payment`)
- **Inactive Accounts**: When a new Stellar keypair is generated offline, Horizon RPC returns `404 Not Found`.
- **First Funding with XLM**: 
  - To activate a new account, the Stellar transaction must use the **`createAccount`** operation with a `startingBalance` of $\ge 1\text{ XLM}$.
  - Standard `payment` operations to an inactive address will fail with `op_no_destination`.
- **Once Active**: Subsequent XLM transfers use the standard **`payment`** operation.

### B. USDC Trustlines (`ChangeTrust`)
- **Asset Identifier**: On Stellar, custom assets are identified by `[Asset Code] + [Issuer Public Key]`.
  - **Official Circle Mainnet USDC Issuer**: `GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN`
  - **Official Circle Testnet USDC Issuer**: `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`
- **Base Reserve Requirement**: Opening a trustline reserves **0.5 XLM** on the account's ledger balance. Therefore, an account needs at least $\approx 1.5\text{ XLM}$ total to comfortably open and maintain a USDC trustline.
- **Claimable Balances (Pending Payments)**:
  - If external wallets (e.g., LOBSTR, Vibrant, Coinbase) attempt to send USDC to a Stellar address that has no active USDC trustline, the network rejects standard payments.
  - External wallets fall back to locking funds into a **Claimable Balance** (Pending Payment), requiring the recipient to establish a trustline before claiming the funds.

---

## 3. Jumpa's Automated Architecture

Jumpa completely automates account activation and trustline setup so users do not need to manually configure raw Stellar operations.

```
                    [ 1. Wallet Created ]
                              │
                              ▼
                   [ 2. User Deposits XLM ]
                              │
                              ▼
            ┌───────────────────────────────────┐
            │ 3. Horizon Balance Check (RPC)   │
            └─────────────────┬─────────────────┘
                              │
                    xlm >= 1.5 XLM?
                   ┌──────────┴──────────┐
                   │                     │
                [ YES ]               [ NO ]
                   │                     │
                   ▼                     ▼
        ┌─────────────────────┐    ┌──────────────────────────┐
        │ Auto-Trigger        │    │ Wait for XLM deposit     │
        │ ensureTrustline()   │    │ (User informed)          │
        └──────────┬──────────┘    └──────────────────────────┘
                   │
                   ▼
     ┌────────────────────────────┐
     │ Submit ChangeTrust for     │
     │ Circle USDC (Main/Test)    │
     └─────────────┬──────────────┘
                   │
                   ▼
     [ 4. USDC Direct Transfers Enabled ]
```

---

## 4. Key Utilities & Source Files

### 1. `src/shared/utils/ensureStellarTrustline.ts`
Automates trustline creation:
- Checks if the user's Stellar account has an active USDC trustline for Circle's issuer.
- Verifies that XLM balance is $\ge 1.5\text{ XLM}$.
- Signs and submits `StellarSdk.Operation.changeTrust({ asset: usdcAsset })`.

### 2. `src/shared/utils/getStellarBalances.ts`
- Fetches real-time native XLM and USDC balances from Horizon RPC (`https://horizon.stellar.org`).
- Automatically triggers `ensureStellarTrustline()` in the background whenever a funded wallet ($\ge 1.5\text{ XLM}$) is queried.

### 3. `src/shared/utils/sendStellarTransaction.ts`
Handles transaction building and pre-transfer validation:
- **XLM Transfers**: Checks if recipient address is active. If recipient is a brand new account, uses `createAccount` ($\ge 1\text{ XLM}$); otherwise uses `payment`.
- **USDC Transfers**:
  - Automatically verifies and opens the **Sender's** USDC trustline.
  - Pre-checks the **Recipient's** account status on Horizon:
    - If Recipient is inactive (`404`), notifies sender that recipient needs at least 1 XLM.
    - If Recipient lacks a USDC trustline, notifies sender to have recipient open a USDC trustline.

---

## 5. Verification & Testing Instructions

### A. Testing Account Activation & XLM Funding
1. Generate a new Stellar wallet in Telegram using `/wallet`.
2. Send **2 XLM** from an external wallet/exchange to your Jumpa Stellar public key (`G...`).
3. Check `/wallet` in Telegram — the wallet status will update to **Active**, showing your native XLM balance.

### B. Testing USDC Trustline Auto-Setup
1. Once XLM balance is $\ge 1.5\text{ XLM}$, Jumpa's background trigger opens the USDC trustline.
2. Send **USDC** from any external wallet (LOBSTR, Vibrant, Coinbase) directly to your Jumpa Stellar address.
3. The USDC transfer will succeed instantly as a **direct payment** (without claimable pending prompts).

---

## 6. Official Reference Links

- [Circle Official Stellar USDC Documentation](https://developers.circle.com/stablecoins/docs/stellar-usdc)
- [Circle Quickstart: Setup USDC Trustline on Stellar](https://developers.circle.com/stablecoins/quickstart-setup-usdc-trustline-stellar)
- [Stellar Official Trustlines Documentation](https://developers.stellar.org/docs/learn/fundamentals/stellar-data-structures/accounts#trustlines)
- [Stellar Explorer Mainnet USDC Issuer](https://stellarchain.io/address/GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN)
