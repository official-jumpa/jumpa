import mongoose from "mongoose";
import Withdrawal from "../src/database/models/withdrawal";
import { config } from "../src/core/config/config";

// Configuration
const YARA_API_BASE_URL = "https://api.yara.cash/widget";
const YARA_PUBLIC_KEY = config.yaraApiKey;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000; // 5 seconds

interface YaraApiResponse {
  data: {
    id: string;
    status: string;
    depositAmount: number;
    depositAmountInUSD: number;
    depositCurrency: string;
    fiatPayoutAmount: number;
    payoutCurrency: string;
    payoutType: string;
    solAddress: string;
    ethAddress: string;
    btcAddress?: string;
    tronAddress?: string;
    message: string;
    source: string;
  };
  message: string;
}

/**
 * Sleep utility for retry delays
 */
const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Fetch withdrawal status from Yara API with retry logic
 */
async function fetchYaraStatus(
  transactionId: string,
  retryCount = 0
): Promise<YaraApiResponse | null> {
  try {
    console.log(`Fetching status for transaction: ${transactionId} (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);

    const response = await fetch(`${YARA_API_BASE_URL}?id=${transactionId}`, {
      method: "GET",
      headers: {
        "x-yara-public-key": YARA_PUBLIC_KEY,
        Accept: "application/json",
      },
    });

    // Handle rate limiting (429) or server errors (5xx)
    if (response.status === 429 || response.status >= 500) {
      if (retryCount < MAX_RETRIES) {
        console.warn(`Rate limited or server error (${response.status}). Retrying in ${RETRY_DELAY_MS / 1000}s...`);
        await sleep(RETRY_DELAY_MS);
        return fetchYaraStatus(transactionId, retryCount + 1);
      } else {
        console.error(`Max retries reached for transaction ${transactionId}. Status: ${response.status}`);
        return null;
      }
    }

    if (!response.ok) {
      console.error(`API error for transaction ${transactionId}: ${response.status} - ${response.statusText}`);
      return null;
    }

    const data: YaraApiResponse = await response.json();
    return data;
  } catch (error: any) {
    if (retryCount < MAX_RETRIES) {
      console.warn(`Error fetching transaction ${transactionId}:`, error.message);
      console.log(`Retrying in ${RETRY_DELAY_MS / 1000}s...`);
      await sleep(RETRY_DELAY_MS);
      return fetchYaraStatus(transactionId, retryCount + 1);
    } else {
      console.error(`Max retries reached for transaction ${transactionId}:`, error.message);
      return null;
    }
  }
}

/**
 * Update withdrawal status for all pending transactions in the database
 */
async function updateWithdrawalStatus(
  transactionId: string,
  newStatus: string
): Promise<boolean> {
  try {
    const result = await Withdrawal.findOneAndUpdate(
      { transaction_id: transactionId },
      { status: newStatus, updatedAt: new Date() },
      { new: true }
    );

    if (result) {
      console.log(`✅ Updated transaction ${transactionId}: ${result.status} -> ${newStatus}`);
      return true;
    } else {
      console.error(`❌ Transaction ${transactionId} not found in database`);
      return false;
    }
  } catch (error: any) {
    console.error(`Error updating transaction ${transactionId}:`, error.message);
    return false;
  }
}

/**
 * Main function to update all pending withdrawals
 */
async function updatePendingWithdrawals(): Promise<void> {
  try {
    // Connect to database
    if (!config.dbUrl) {
      throw new Error("Database URL not configured. Please set DB_URL in .env");
    }

    console.log("Connecting to database...");
    await mongoose.connect(config.dbUrl);
    console.log("✅ Connected to database\n");

    // Find all withdrawals with pending or empty status
    const pendingWithdrawals = await Withdrawal.find({
      $or: [
        { status: { $in: ["", null] } },
        { status: "DEPOSIT_PENDING" },
      ],
    });

    console.log(`Found ${pendingWithdrawals.length} pending withdrawal(s)\n`);

    if (pendingWithdrawals.length === 0) {
      console.log("No pending withdrawals to update.");
      return;
    }

    // Statistics
    let successCount = 0;
    let failedCount = 0;
    let unchangedCount = 0;

    // Process each withdrawal
    for (const withdrawal of pendingWithdrawals) {
      console.log(`\n${"=".repeat(60)}`);
      console.log(`Processing withdrawal:`);
      console.log(`  Transaction ID: ${withdrawal.transaction_id}`);
      console.log(`  Telegram ID: ${withdrawal.telegram_id}`);
      console.log(`  Current Status: ${withdrawal.status}`);
      console.log(`  Deposit Amount: ${withdrawal.depositAmount}`);
      console.log(`  Payout Amount: ₦${withdrawal.fiatPayoutAmount}`);

      // Fetch status from Yara API
      const yaraResponse = await fetchYaraStatus(withdrawal.transaction_id);

      if (!yaraResponse || !yaraResponse.data) {
        console.log(`  ⚠️  Failed to fetch status from API`);
        failedCount++;
        continue;
      }

      const newStatus = yaraResponse.data.status;
      console.log(`  API Status: ${newStatus}`);

      // Update if status has changed
      if (withdrawal.status !== newStatus) {
        const updated = await updateWithdrawalStatus(
          withdrawal.transaction_id,
          newStatus
        );
        if (updated) {
          successCount++;
        } else {
          failedCount++;
        }
      } else {
        console.log(`  ℹ️  Status unchanged: ${newStatus}`);
        unchangedCount++;
      }
    }

    // Print summary
    console.log(`\n${"=".repeat(60)}`);
    console.log(`\n📊 Summary:`);
    console.log(`  Total processed: ${pendingWithdrawals.length}`);
    console.log(`  ✅ Successfully updated: ${successCount}`);
    console.log(`  ℹ️  Unchanged: ${unchangedCount}`);
    console.log(`  ❌ Failed: ${failedCount}`);
    console.log("");
  } catch (error: any) {
    console.error("Fatal error:", error.message);
    console.error(error.stack);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log("Database connection closed.");
  }
}

// Run the script
console.log("🚀 Starting Withdrawal Status Update Script\n");
updatePendingWithdrawals()
  .then(() => {
    console.log("\n✅ Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  });
