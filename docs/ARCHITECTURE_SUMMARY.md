# Jumpa Bot - Architecture Summary

## Project Overview
**Jumpa** is a Telegram-based cryptocurrency trading bot that enables multi-chain trading on Solana and EVM blockchains, multi-wallet management, and P2P fiat withdrawals.

**Tech Stack**: Node.js + TypeScript, Telegraf (Telegram Bot), MongoDB, Solana web3.js, ethers.js

---

## 1. USER MANAGEMENT & STORAGE

### Database Schema (MongoDB + Mongoose)
**Location**: `/src/database/models/user.ts`

**User Model Structure**:
```
User Document
├── telegram_id (Number, unique, indexed)
├── username (String, indexed)
├── solanaWallets (Array)
│   ├── address (String, indexed)
│   ├── encryptedPrivateKey (String)
│   ├── balance (Number) - cached SOL balance
│   ├── last_updated_balance (Date)
│   ├── usdcBalance (Number)
│   ├── usdtBalance (Number)
│   └── last_updated_token_balance (Date)
├── evmWallets (Array)
│   ├── address (String, indexed)
│   ├── encryptedPrivateKey (String)
│   ├── balance (Number)
│   └── last_updated_balance (Date)
├── referrals
│   ├── referredBy (Number, nullable)
│   ├── totalReferrals (Number)
│   └── myReferrals (Array of telegram_ids)
├── bank_details
│   ├── account_number
│   ├── account_name
│   ├── bank_name
│   ├── bank_code
│   └── withdrawalPin (Number)
├── is_active (Boolean)
├── role (Enum: "user" | "admin")
├── created_at, updated_at, last_seen (Dates)
└── timestamps (automatic)
```

### Key Features:
- **Multi-chain wallets**: Supports both Solana and EVM (Celo, Base, Optimism, Polygon, Arbitrum)
- **Encrypted storage**: Private keys are encrypted using AES encryption
- **Balance caching**: SOL balance cached with 5-minute TTL, token balances cached separately
- **Referral tracking**: Built-in referral system with referred-by relationship and referral counts
- **Bank integration**: Stores Nigerian bank details for fiat withdrawals with PIN protection
- **Role-based access**: User vs Admin roles

### User Registration Flow
1. User sends `/start` command
2. System checks if telegram_id exists in database
3. If not, creates new user document with generated wallet
4. User can add multiple wallets (Solana/EVM)
5. Private keys encrypted and stored

---

## 2. TRADING & TRANSACTION TRACKING

### Transaction Architecture

**Order State Management** (`/src/shared/state/orderState.ts`):
```
OrderState (In-memory Map<userId, OrderState>)
├── transactionBase64: string (serialized transaction)
└── requestId: string (unique request identifier)
```

**Trade State Management** (`/src/shared/state/tradeState.ts`):
```
TradeState (In-memory Map<tradeId, TradeStateData>)
├── contractAddress: string
├── symbol: string
├── decimals: number
└── [15-minute TTL for cleanup]
```

### Buy Trading Flow
1. **Token Detection** (`DetectTokenAddress.ts`)
   - User sends Solana token address
   - System fetches token info from on-chain metadata
   - Creates trade session with token details
   - Stores in TradeState (15-min expiry)

2. **Quote Fetching** (`getOrder.ts`)
   - Calls Jupiter API for price quotes
   - Calculates input amount, output amount, price impact
   - Returns transaction base64 and request ID
   - Fee calculation: ~9k lamports per transaction

3. **Buy Order Creation** (`createBuyOrder.ts`)
   - User selects amount to spend
   - System fetches Jupiter quote
   - Displays order details:
     - Token address and symbol
     - Amount in SOL
     - Expected token output
     - Price impact percentage
     - Transaction fee in SOL
   - User approves or declines
   - Stores OrderState with serialized transaction

4. **Order Execution** (`executeOrder.ts`)
   - Deserializes transaction
   - User signs transaction with their private key
   - Transaction broadcast to Solana network
   - Confirmation awaited

### Sell Trading Flow
Similar to buy but in reverse:
- User selects token from wallet
- System fetches sell quote from Jupiter
- User confirms sale
- Token transferred out, SOL transferred in

### Transaction Tracking
- **Blockchain**: Solana explorer tracks all on-chain transactions
- **Database**: Withdrawal records stored in `Withdrawal` model for fiat off-ramp tracking
- **State Management**: Temporary order/trade state in memory (cleared after execution)

---

## 3. PAYMENT & REWARD SYSTEMS

### Payment Gateway Integration
**Supported Fiat**: Nigerian NGN (Naira)
**Gateway**: Yara Payment (API key configured)

### Withdrawal System

#### Solana Withdrawals (`WithdrawToNgn.ts`)

**SOL Withdrawal**:
1. User initiates withdrawal via bot
2. System validates:
   - User exists and has Solana wallet
   - Private key accessible
   - Sufficient SOL balance (amount + ~5k lamports fee)
3. Creates SystemProgram.transfer transaction
4. Signs with user's private key
5. Broadcasts to Solana mainnet
6. Waits for confirmation
7. Returns transaction signature and Solscan URL

**USDC/USDT Withdrawal** (SPL Tokens on Solana):
1. Validates token account exists
2. Gets mint information (decimals)
3. Creates SPL token transfer instruction
4. Handles recipient token account creation if needed
5. Bundles transaction and broadcasts
6. Verifies SOL for transaction fees separately

#### EVM Withdrawals (`EvmWithdrawal.ts`)

**Supported Chains & Tokens**:
- **Celo**: USDC, USDT
- **Base**: USDC, USDT
- **Optimism**, **Polygon**, **Arbitrum**: Support framework in place

**ETH Withdrawal**:
1. User connects EVM wallet
2. System gets wallet from ethers.js Wallet class
3. Estimates gas costs
4. Verifies ETH balance >= amount + gas
5. Creates and signs transaction
6. Broadcasts to selected chain RPC
7. Waits for confirmation

**ERC-20 Token Withdrawal** (USDC/USDT):
1. Creates contract instance with ERC20 ABI
2. Checks token balance
3. Estimates gas for token transfer
4. Verifies sufficient ETH for gas
5. Executes transfer() with gas limit and price
6. Waits for receipt

### Withdrawal State Management
**Location**: `/src/shared/state/withdrawalState.ts`
```
WithdrawalState (In-memory Map<userId, WithdrawalState>)
├── step: 'awaiting_pin' | 'awaiting_custom_amount'
└── data
    ├── amount: string
    ├── currency: 'SOL' | 'USDC' | 'USDT' | 'ETH'
    └── chain: 'SOLANA' | 'CELO' | 'BASE' | 'OPTIMISM' | 'POLYGON' | 'ARBITRUM
```

### Withdrawal Process
1. **Bank Account Setup**
   - User provides Nigerian bank account
   - Stores: account number, account name, bank name, bank code
   - Sets withdrawal PIN (stored hashed)

2. **Withdrawal Request**
   - User selects currency (SOL/USDC/USDT/ETH)
   - Selects amount or enters custom amount
   - System initiates on-chain transfer (immediate)
   - Yara API called to convert crypto -> NGN fiat
   - Fiat transferred to user's bank account

3. **Withdrawal Tracking**
   - All withdrawals logged in `Withdrawal` model:
     - telegram_id
     - transaction_id (unique)
     - fiatPayoutAmount
     - depositAmount
     - yaraWalletAddress
     - status
     - timestamps

### Referral & Rewards (Potential)
- Referral system implemented in User model
- referredBy: tracks who referred the user
- myReferrals: array of users you referred
- totalReferrals: count of referred users

---

## 4. BOT COMMAND STRUCTURE & USER INTERACTION FLOW

### Command Architecture
**Location**: `/src/bot/commands/`

**Base Command Class** (`BaseCommand.ts`):
```typescript
abstract class BaseCommand {
  abstract name: string;
  abstract description: string;
  abstract execute(ctx: Context): Promise<void>
}
```

**Command Manager** (`CommandManager.ts`):
- Registers all commands dynamically
- Routes commands to handlers
- Manages callback query handlers
- Updates bot command menu

### Registered Commands
1. `start` - User registration & main menu
2. `help` - Help documentation
3. `wallet` - Wallet info & management
4. `deposit` - Deposit funds
5. `referral` - Referral system info

### Callback Handler System
**Inline Buttons**:

**Onboarding Callbacks**:
- `view_wallet`, `view_profile` - Profile/wallet display
- `generate_wallet`, `import_wallet` - Wallet setup
- `add_wallet`, `add_wallet_solana`, `add_wallet_evm` - Multi-wallet
- `set_default_solana:`, `set_default_evm:` - Default wallet selection

**Trading Callbacks**:
- `/^buy:.+/` - Buy token with amount
- `approve_buy:`, `decline_buy` - Buy confirmation
- `buy_custom:` - Custom amount buying
- `/^sell:.+/` - Sell token
- `approve_sell:`, `decline_sell` - Sell confirmation
- `/^refresh:.+/` - Refresh order data

**Wallet Callbacks**:
- `deposit_sol`, `withdraw_sol`, `withdraw_to_bank` - Withdrawal flow
- `refresh_balance` - Update cached balance
- `withdraw_currency:`, `withdraw_custom_amount:` - Withdrawal steps
- `export_private_key`, `proceed_export`, `cancel_export` - Key export

**Text Message Handlers**:
- Awaiting custom amount input
- Awaiting private key import
- Awaiting wallet import
- Awaiting bank details
- Awaiting withdrawal PIN
- Detecting Solana token addresses

### User Interaction Flow (Example: Buy Token)

```
User sends token address
    ↓
Text handler detects Solana address pattern
    ↓
System fetches token metadata from on-chain
    ↓
Creates TradeState with token details (15-min TTL)
    ↓
Bot displays: Symbol, current price, balance check
    ↓
User clicks "Buy [amount]" button
    ↓
handleBuy callback triggered with buy:[tradeId]:[amount]
    ↓
createBuyOrder() fetches Jupiter quote
    ↓
OrderState stored with transaction base64
    ↓
Bot displays order details with "Approve"/"Decline" buttons
    ↓
User clicks "Approve"
    ↓
BuyCallbackHandlers.handleApprove() executes
    ↓
deserializeTransaction() + sign with user's private key
    ↓
Transaction broadcast to Solana
    ↓
Confirmation awaited
    ↓
Bot sends confirmation with Solscan link
```

### Multi-Step Flow State Management
**Location**: `/src/shared/state/`
- `userActionState.ts` - Current user action (import, export, add wallet, etc.)
- `bankState.ts` - Bank detail update flow
- `withdrawalState.ts` - Withdrawal process step
- `orderState.ts` - Pending buy/sell order
- `tradeState.ts` - Active token trade session

---

## 5. WALLET & BALANCE MANAGEMENT

### Wallet Service Architecture

**Balance Retrieval** (`getBalance.ts`)
```typescript
async getBalance(walletAddress, forceRefresh = false): Promise<number>
```
- Checks database for cached balance
- If cache valid (< 5 min) and not force-refresh, return cached
- Otherwise fetch from Solana RPC (getBalance RPC call)
- Updates database cache with new balance
- Falls back to cached value on error

**Token Balances** (`getTokenBalances.ts`)
- Fetches USDC/USDT balances for Solana wallet
- Uses getParsedTokenAccountsByOwner RPC method
- Extracts token amount from parsed account data
- Returns formatted amounts

### Wallet Command (`WalletCommand.ts`)

**Displays**:
```
Address: <wallet_address>
SOL: X.XXXX
USDC: X.X
USDT: X.X
Last Updated: <timestamp>
```

**Actions**:
- Refresh Balance (force cache update)
- Show Private Key (with PIN verification)
- Wallet Details
- Close menu

### Individual Wallet Storage
Each user document stores arrays of wallets:

**Solana Wallets**:
```
solanaWallets: [
  {
    address,
    encryptedPrivateKey,
    balance,
    last_updated_balance,
    usdcBalance,
    usdtBalance,
    last_updated_token_balance
  }
]
```

**EVM Wallets**:
```
evmWallets: [
  {
    address,
    encryptedPrivateKey,
    balance,
    last_updated_balance
  }
]
```

### Wallet Creation
- **Solana**: Uses `@solana/web3.js` Keypair.generate()
- **EVM**: Uses `ethers.js` Wallet.createRandom()
- Private key immediately encrypted with AES-256
- Stored hex-encoded in database
- Original key never stored unencrypted

### Encryption/Decryption
**Location**: `/src/shared/utils/encryption.ts`
- Uses `ENCRYPTION_KEY` from environment (256-bit hex)
- AES-256 encryption with crypto module
- Keys returned as hex strings for storage
- Decryption on-demand when needed for transactions

---

---

---

## 7. BLOCKCHAIN INTEGRATION

### Solana Integration
**Framework**: Anchor (Solana smart contract framework)
**RPC Endpoints**: Mainnet-beta and Devnet configured

**Key Functions** (`/src/blockchain/solana/`):

- **`executeTrade.ts`**: Swaps tokens via Jupiter CPI
- **`deposit.ts`**: Transfers SOL to account

### Jupiter Integration (DEX Aggregation)
- Used for token swaps
- Fetches best price routes across liquidity pools
- CPI (Cross-Program Invocation) integration for trades
- 2% slippage default setting

### EVM Chain Support
**Chains**: Celo, Base, Optimism, Polygon, Arbitrum
**Framework**: ethers.js v6
**Functions**: Withdraw ETH/USDC/USDT to fiat

---

## 8. DATA MODELS SUMMARY

### Two Main Collections:

**1. User**
- Core user identity & authentication
- Multi-wallet storage (Solana + EVM)
- Referral tracking
- Bank account info for fiat
- Cached balance data

**2. Withdrawal**
- Audit trail for fiat conversions
- Tracks: user, transaction ID, amounts, wallet address
- Links crypto withdrawals to fiat payouts

---

## 9. STATE MANAGEMENT PATTERNS

### In-Memory State (Maps)
- **userActionState**: Current user's multi-step action
- **bankState**: Bank update flow
- **withdrawalState**: Withdrawal process step
- **orderState**: Pending buy/sell order
- **tradeState**: Active token trade session (15-min TTL)

### Database State
- User balance cache (5-min TTL)
- Trade history and polls
- Bank account details
- Referral relationships

### Blockchain State
- Deposits and balances
- Trade execution records
- Token ownership and transfers

---

## 10. SECURITY FEATURES

1. **Private Key Encryption**
   - AES-256 encryption on all stored private keys
   - Encryption key from environment variable
   - Keys never logged or exposed

2. **PIN Protection**
   - Withdrawal PIN stored in user model
   - Required for exporting private keys
   - Required for fiat withdrawals

3. **Access Control**
   - Role-based: user vs admin

4. **Transaction Verification**
   - Signature confirmation before broadcast
   - Balance verification before execution
   - Gas/fee estimation and checking
   - Recipient address validation

5. **Rate Limiting**
   - Middleware logging response times
   - Command execution error handling
   - Callback query validation

---

## 11. KEY ENTRY POINTS

### Bot Initialization
`/src/index.ts`:
```
1. Connect to MongoDB
2. Create Telegraf bot instance
3. Initialize CommandManager
4. Register all commands and callbacks
5. Error handling and graceful shutdown
6. bot.launch()
```

### User Registration
`StartCommand.ts`:
```
1. Check if user exists
2. If not, create new User document
3. Generate Solana wallet
4. Encrypt private key
5. Display wallet address and menu
```

### Trading Flow
`BuyCommand.ts` -> `createBuyOrder.ts`:
```
1. Detect token address from text
2. Create TradeState
3. Fetch Jupiter quote
4. Create OrderState
5. Wait for user approval
6. Execute transaction
```

---

## SUMMARY TABLE

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Bot Framework | Telegraf 4.16 | Telegram bot interface |
| Database | MongoDB + Mongoose 8.19 | User, wallet, trade, withdrawal data |
| Solana | @solana/web3.js | On-chain wallet & token swaps |
| EVM | ethers.js 6.15 | Multi-chain wallet support |
| DEX | Jupiter API | Token swaps |
| Encryption | Node.js crypto | Private key security |
| State | In-memory Maps | Multi-step user flows |
| Deployment | Node.js + TypeScript | Runtime environment |

---

## FLOW DIAGRAMS

### User Registration Flow
```
/start
  ↓
Is user in DB?
  ↓ No
Create User document
  ↓
Generate Solana Keypair
  ↓
Encrypt private key
  ↓
Save to DB
  ↓
Display wallet address & menu
```

### Individual Trading Flow 
```
Token address detected (text message)
  ↓
Create TradeState (15-min TTL)
  ↓
Show token info & balance
  ↓
User clicks "Buy X SOL"
  ↓
Fetch Jupiter quote
  ↓
Create OrderState
  ↓
Show order details
  ↓
User approves
  ↓
Sign transaction
  ↓
Broadcast to Solana
  ↓
Confirmation
  ↓
Update balances
```

### Withdrawal Flow
```
User initiates withdrawal
  ↓
Select currency & amount
  ↓
Validate balance & fees
  ↓
Create blockchain transaction
  ↓
Request PIN verification
  ↓
Sign & broadcast
  ↓
Confirm on-chain
  ↓
Log in Withdrawal model
  ↓
Call Yara API for fiat conversion
  ↓
Fiat transferred to bank account
```