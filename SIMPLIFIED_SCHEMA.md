# 🎯 Simplified Database Schema for Jumpa Ajo Bot MVP

## 📋 Overview

This simplified schema reduces the number of models while maintaining core functionality for the MVP. Focus on essential features first, then expand later.

---

## 🍃 Simplified MongoDB Models (2 Core Models)

### 1. User Model (Essential)

```typescript
// models/user.ts
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
    },
    wallet_address: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    private_key_encrypted: {
      type: String,
      required: true,
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

const User = mongoose.model("User", userSchema);
export default User;
```

### 2. AjoGroup Model (Core)

```typescript
// models/ajoGroup.ts
import mongoose from "mongoose";

const ajoGroupSchema = new mongoose.Schema(
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
    initial_capital: {
      type: Number,
      required: true,
      min: 0,
    },
    max_members: {
      type: Number,
      required: true,
      min: 2,
      max: 100,
    },
    consensus_threshold: {
      type: Number,
      required: true,
      min: 50,
      max: 100,
      default: 67,
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
          enum: ["trade", "end_ajo"],
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
ajoGroupSchema.index({ creator_id: 1 });
ajoGroupSchema.index({ telegram_chat_id: 1 });
ajoGroupSchema.index({ status: 1 });
ajoGroupSchema.index({ "members.user_id": 1 });

const AjoGroup = mongoose.model("AjoGroup", ajoGroupSchema);
export default AjoGroup;
```

---

## 🎯 Why This Simplified Approach?

### ✅ **Benefits:**

1. **Only 2 models** instead of 7
2. **Embedded documents** for related data (members, polls, trades)
3. **Direct telegram_id references** - no ObjectId conversions
4. **Faster queries** - less joins needed
5. **Easier to understand** and maintain
6. **MVP-focused** - covers all essential features

### ⚠️ **Trade-offs:**

1. **Less normalized** - some data duplication
2. **Document size limits** - MongoDB has 16MB limit per document
3. **Atomic updates** - harder to update individual polls/members
4. **Scalability** - may need to refactor later for large groups

---

## 🔧 Usage Examples

### Creating an Ajo Group

```typescript
const ajoGroup = new AjoGroup({
  name: "CryptoCrew",
  creator_id: 123456789,
  telegram_chat_id: -987654321,
  initial_capital: 1000,
  max_members: 10,
  consensus_threshold: 67,
  members: [
    {
      user_id: 123456789,
      role: "trader",
      contribution: 100,
    },
  ],
  polls: [],
  trades: [],
});
```

### Adding a Member

```typescript
await AjoGroup.findByIdAndUpdate(groupId, {
  $push: {
    members: {
      user_id: 987654321,
      role: "member",
      contribution: 50,
    },
  },
});
```

### Creating a Poll

```typescript
const pollId = new mongoose.Types.ObjectId().toString();
await AjoGroup.findByIdAndUpdate(groupId, {
  $push: {
    polls: {
      id: pollId,
      creator_id: 123456789,
      type: "trade",
      title: "Buy 100 BONK",
      token_address: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
      token_symbol: "BONK",
      amount: 100,
      status: "open",
      votes: [],
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    },
  },
});
```

### Adding a Vote

```typescript
await AjoGroup.findOneAndUpdate(
  {
    _id: groupId,
    "polls.id": pollId,
    "polls.votes.user_id": { $ne: voterId }, // Ensure no duplicate votes
  },
  {
    $push: {
      "polls.$.votes": {
        user_id: voterId,
        vote: true,
      },
    },
  }
);
```

### Getting Group Info

```typescript
const group = await AjoGroup.findById(groupId);
console.log(`Group: ${group.name}`);
console.log(`Members: ${group.members.length}/${group.max_members}`);
console.log(
  `Active polls: ${group.polls.filter((p) => p.status === "open").length}`
);
```

---

## 🚀 When to Expand Back to Separate Models

Consider moving to separate models when you hit these limits:

1. **Group size** - More than 50-100 members
2. **Poll frequency** - More than 100 active polls per group
3. **Complex queries** - Need to query polls across multiple groups
4. **Performance issues** - Document size approaching 16MB
5. **Advanced features** - Need complex relationships and constraints

---

## 💡 Migration Strategy

When you need to expand later:

1. **Keep current schema** for MVP
2. **Add new separate models** alongside embedded ones
3. **Gradually migrate** data from embedded to separate models
4. **Update queries** to use new models
5. **Remove embedded fields** once migration is complete

This gives you a working MVP quickly while maintaining the option to scale up later!
