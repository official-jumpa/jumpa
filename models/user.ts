import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    telegram_id: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    username: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    wallet_address: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    user_balance: {
      type: Number,
      default: 0,
    },
    last_updated_balance: {
      type: Date,
      default: Date.now,
    },
    private_key: {
      type: String,
      required: true,
    },
    bank_details: {
      account_number: {
        type: String,
        default: "",
      },
      account_name: {
        type: String,
        default: "",
      },
      bank_name: {
        type: String,
        default: "",
      },
      bank_code: {
        type: String,
        default: "",
      },
      withdrawalPin: {
        type: Number,
        default: 0,
      },
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
    updated_at: {
      type: Date,
      default: Date.now,
    },
    last_seen: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model("User", userSchema);

export default User;