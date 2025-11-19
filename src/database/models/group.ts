import mongoose from "mongoose";

const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    creator_id: {
      type: Number, // telegram_id
      ref: "User",
      required: true,
    },
    telegram_chat_id: {
      type: Number,
      required: true,
      unique: true,
    },
    is_private: {
      type: Boolean,
      default: false,
    },
    max_members: {
      type: Number,
      required: true,
      min: 2,
      max: 100,
    },
    status: {
      type: String,
      enum: ["active", "ended"],
      default: "active",
    },
    // Embedded members array - simplified!
    members: [
      {
        user_id: {
          type: Number, // telegram_id
          required: true,
        },
        role: {
          type: String,
          enum: ["member", "trader"],
          default: "member",
        },
        contribution: {
          type: Number,
          default: 0,
        },
        joined_at: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    // Embedded polls array - simplified!
    polls: [
      {
        id: {
          type: String,
          required: true,
        },
        creator_id: {
          type: Number, // telegram_id
          required: true,
        },
        type: {
          type: String,
          enum: ["trade", "end_group"],
          required: true,
        },
        title: {
          type: String,
          required: true,
        },
        token_address: {
          type: String,
        },
        token_symbol: {
          type: String,
        },
        amount: {
          type: Number,
        },
        status: {
          type: String,
          enum: ["open", "executed", "cancelled"],
          default: "open",
        },
        votes: [
          {
            user_id: {
              type: Number, // telegram_id
              required: true,
            },
            vote: {
              type: Boolean, // true = yes, false = no
              required: true,
            },
            voted_at: {
              type: Date,
              default: Date.now,
            },
          },
        ],
        created_at: {
          type: Date,
          default: Date.now,
        },
        expires_at: {
          type: Date,
          required: true,
        },
      },
    ],
    // Embedded trades array - simplified!
    trades: [
      {
        poll_id: {
          type: String,
          required: true,
        },
        token_symbol: {
          type: String,
          required: true,
        },
        amount: {
          type: Number,
          required: true,
        },
        price_per_token: {
          type: Number,
          required: true,
        },
        executed_at: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    current_balance: {
      type: Number,
      default: 0,
    },
    // On-chain data
    onchain_group_address: {
      type: String,
      required: false,
    },
    onchain_tx_signature: {
      type: String,
      required: false,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
groupSchema.index({ creator_id: 1 });
groupSchema.index({ status: 1 });
groupSchema.index({ "members.user_id": 1 });

const Group = mongoose.model("Group", groupSchema);
export default Group;
