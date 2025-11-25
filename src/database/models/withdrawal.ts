import mongoose from "mongoose";

const withdrawalSchema = new mongoose.Schema(
  {
    telegram_id: {
      type: Number,
      required: true,
    },
    transaction_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    fiatPayoutAmount: {
      type: Number,
      required: true,
    },
    depositAmount: {
      type: Number,
      required: true,
    },
    yaraWalletAddress: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      required: true,
      default: "DEPOSIT_PENDING",
    },
  },
  {
    timestamps: true,
  }
);

const Withdrawal = mongoose.model("Withdrawal", withdrawalSchema);

export default Withdrawal;
