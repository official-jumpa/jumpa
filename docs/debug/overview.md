# Jumpa Project Overview

## Description
Jumpa is a Telegram bot application designed for managing groups (rotating savings), governance, trading, and payments. It integrates with the Solana blockchain (and potentially Ethereum) and uses MongoDB for data persistence.

## Tech Stack
- **Runtime**: Node.js
- **Language**: TypeScript
- **Bot Framework**: Telegraf
- **Database**: MongoDB (Mongoose)
- **Blockchain**:
  - Solana (`@solana/web3.js`, `@coral-xyz/anchor`, `@solana/spl-token`)
  - Ethereum (`ethers`) - *Note: Presence of ethers suggests potential EVM support*
- **Utilities**: `axios`, `dotenv`, `bs58`

## Directory Structure
- **`src/`**: Source code root.
  - **`blockchain/`**: Blockchain interaction logic.
  - **`bot/`**: Telegram bot specific logic.
    - **`commands/`**: Command handlers and manager.
    - **`callbacks/`**: Callback query handlers.
  - **`core/`**: Core configuration and setup.
    - **`config/`**: App configuration and database connection.
  - **`database/`**: Database models and schemas.
  - **`modules/`**: Feature-specific modules.
    - **`groups/`**: Logic for groups.
    - **`governance/`**: Governance features.
    - **`onboarding/`**: User onboarding flows.
    - **`payments/`**: Payment processing.
    - **`referral/`**: Referral system.
    - **`trading/`**: Trading functionality.
    - **`users/`**: User management.
    - **`wallets/`**: Wallet management.
  - **`shared/`**: Shared utilities and types.
  - **`index.ts`**: Application entry point.

## Scripts
- **`npm run dev`**: Runs the bot in development mode using `nodemon` and `ts-node`.
- **`npm run build`**: Compiles TypeScript code to `dist/`.
- **`npm start`**: Runs the compiled code from `dist/index.js`.
- **`npm run watch`**: Runs the TypeScript compiler in watch mode.

## Key Components
- **Entry Point**: `src/index.ts` initializes the bot, connects to the database, and starts the `CommandManager`.
- **Command Manager**: `src/bot/commands/CommandManager.ts` is the central hub for:
  - Registering commands (e.g., `/start`, `/help`, `/wallet`).
  - Handling callback queries from inline keyboards (using both string literals and regex).
  - Handling text inputs for specific states (e.g., entering custom amounts, private keys).
- **Database**: `src/core/config/database.ts` handles MongoDB connection.

## State Management
The bot uses in-memory state management for multi-step interactions.
- **User Actions**: `src/shared/state/userActionState.ts` tracks states like `awaiting_custom_buy_amount`, `awaiting_export_pin`, `awaiting_import_private_key`.
- **Bank Updates**: `src/shared/state/bankState.ts` tracks bank account update steps.
- **Withdrawals**: `src/shared/state/withdrawalState.ts` tracks withdrawal steps (amount, pin).

## Debugging Tips
- **Logs**: The bot has middleware in `src/index.ts` that logs response time. Check console output for errors and logs.
- **Database**: Ensure MongoDB is running and accessible. Check `src/core/config/config.ts` for connection string.
- **Environment Variables**: Ensure `.env` file is present and contains necessary variables (e.g., `BOT_TOKEN`).
- **Command Issues**: If a command isn't working, check `src/bot/commands/CommandManager.ts` to see if it's registered and if the handler is correct.
- **Callback Issues**: For button clicks, check the `setupCommandHandlers` method in `CommandManager.ts`. Note that some callbacks use regex.
- **State Issues**: If the bot seems "stuck" in a mode (e.g., expecting a number), it might be due to a stale state in one of the state managers.
