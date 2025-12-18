import mongoose from "mongoose";
import Withdrawal from "../src/core/database/models/withdrawal";
import { config } from "../src/core/config/environment";

/**
 * Calculate and display withdrawal statistics
 * Shows totals for:
 * - PAYOUT_SUCCESS withdrawals
 * - DEPOSIT_PENDING withdrawals
 * - All withdrawals combined
 */
async function getWithdrawalStats() {
  try {
    // Connect to database
    if (!config.dbUrl) {
      throw new Error("Database URL not configured. Please set DB_URL in .env");
    }

    console.log("Connecting to database...");
    await mongoose.connect(config.dbUrl);
    console.log("✅ Connected to database\n");

    console.log("=".repeat(70));
    console.log("                    WITHDRAWAL STATISTICS REPORT");
    console.log("=".repeat(70));
    console.log("");

    // Get PAYOUT_SUCCESS stats
    const payoutSuccessStats = await Withdrawal.aggregate([
      { $match: { status: "PAYOUT_SUCCESS" } },
      {
        $group: {
          _id: null,
          totalDepositAmount: { $sum: "$depositAmount" },
          totalFiatPayoutAmount: { $sum: "$fiatPayoutAmount" },
          count: { $sum: 1 },
        },
      },
    ]);

    const payoutSuccess = payoutSuccessStats[0] || {
      totalDepositAmount: 0,
      totalFiatPayoutAmount: 0,
      count: 0,
    };

    // Get DEPOSIT_PENDING stats
    const depositPendingStats = await Withdrawal.aggregate([
      { $match: { status: "DEPOSIT_PENDING" } },
      {
        $group: {
          _id: null,
          totalDepositAmount: { $sum: "$depositAmount" },
          totalFiatPayoutAmount: { $sum: "$fiatPayoutAmount" },
          count: { $sum: 1 },
        },
      },
    ]);

    const depositPending = depositPendingStats[0] || {
      totalDepositAmount: 0,
      totalFiatPayoutAmount: 0,
      count: 0,
    };

    // Get ALL withdrawals stats
    const allWithdrawalsStats = await Withdrawal.aggregate([
      {
        $group: {
          _id: null,
          totalDepositAmount: { $sum: "$depositAmount" },
          totalFiatPayoutAmount: { $sum: "$fiatPayoutAmount" },
          count: { $sum: 1 },
        },
      },
    ]);

    const allWithdrawals = allWithdrawalsStats[0] || {
      totalDepositAmount: 0,
      totalFiatPayoutAmount: 0,
      count: 0,
    };

    // Get breakdown by all statuses
    const statusBreakdown = await Withdrawal.aggregate([
      {
        $group: {
          _id: "$status",
          totalDepositAmount: { $sum: "$depositAmount" },
          totalFiatPayoutAmount: { $sum: "$fiatPayoutAmount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    // Display results
    console.log("📊 Successful Withdrawals");
    console.log("-".repeat(70));
    console.log(`   Number of withdrawals:    ${payoutSuccess.count}`);
    console.log(`   Total amount withdrawn: ₦${payoutSuccess.totalFiatPayoutAmount.toFixed(2)}`);
    console.log("");

    console.log("⏳  Pending Withdrawals");
    console.log("-".repeat(70));
    console.log(`   Number of withdrawals:    ${depositPending.count}`);
    console.log(`   Total pending deposit amount:     ${depositPending.totalDepositAmount.toFixed(4)}`);
    console.log(`   Total pending fiat payout amount: ₦${depositPending.totalFiatPayoutAmount.toFixed(2)}`);
    console.log("");

    console.log("🌍 ALL WITHDRAWALS (All Statuses Combined - expired, pending & success)");
    console.log("-".repeat(70));
    console.log(`   Number of withdrawals:    ${allWithdrawals.count}`);
    console.log(`   Total withdrawal amount: ₦${allWithdrawals.totalFiatPayoutAmount.toFixed(2)}`);
    console.log("");

    if (statusBreakdown.length > 0) {
      console.log("📋 BREAKDOWN BY STATUS");
      console.log("-".repeat(70));
      statusBreakdown.forEach((item) => {
        console.log(`\n   Status: ${item._id || "Unknown"}`);
        console.log(`      Count: ${item.count}`); console.log(`      Fiat Payout: ₦${item.totalFiatPayoutAmount.toFixed(2)}`);
      });
      console.log("");
    }

    console.log("=".repeat(70));



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
console.log("\n🚀 Fetching Withdrawal Statistics...\n");
getWithdrawalStats()
  .then(() => {
    console.log("✅ Statistics retrieved successfully\n");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Failed to retrieve statistics:", error);
    process.exit(1);
  });
