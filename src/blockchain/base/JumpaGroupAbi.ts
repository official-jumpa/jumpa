export const jumpaGroupAbi = {
  _format: "hh3-artifact-1",
  contractName: "JumpaGroup",
  contractAddress: "0x545217590B3a822F4bAc37eC98A2EBfCB1Bdc674", //sepolia
  sourceName: "contracts/JumpaGroup.sol",
  abi: [
    {
      inputs: [],
      stateMutability: "nonpayable",
      type: "constructor",
    },
    {
      inputs: [],
      name: "AlreadyBlacklisted",
      type: "error",
    },
    {
      inputs: [],
      name: "AlreadyJoined",
      type: "error",
    },
    {
      inputs: [],
      name: "Blacklisted",
      type: "error",
    },
    {
      inputs: [],
      name: "CannotKickOwner",
      type: "error",
    },
    {
      inputs: [],
      name: "EnforcedPause",
      type: "error",
    },
    {
      inputs: [],
      name: "ExpectedPause",
      type: "error",
    },
    {
      inputs: [],
      name: "GroupIsAlreadyClosed",
      type: "error",
    },
    {
      inputs: [],
      name: "GroupMembersComplete",
      type: "error",
    },
    {
      inputs: [],
      name: "GroupNotOpen",
      type: "error",
    },
    {
      inputs: [],
      name: "GroupNotTrading",
      type: "error",
    },
    {
      inputs: [],
      name: "GroupTradersComplete",
      type: "error",
    },
    {
      inputs: [],
      name: "InsufficientFunds",
      type: "error",
    },
    {
      inputs: [],
      name: "InvalidCapital",
      type: "error",
    },
    {
      inputs: [],
      name: "InvalidInitialization",
      type: "error",
    },
    {
      inputs: [],
      name: "InvalidMinimumOut",
      type: "error",
    },
    {
      inputs: [],
      name: "InvalidName",
      type: "error",
    },
    {
      inputs: [],
      name: "InvalidSlippage",
      type: "error",
    },
    {
      inputs: [],
      name: "InvalidState",
      type: "error",
    },
    {
      inputs: [],
      name: "InvalidSwapPercentage",
      type: "error",
    },
    {
      inputs: [],
      name: "InvalidTokenAddress",
      type: "error",
    },
    {
      inputs: [],
      name: "MemberAlreadyApproved",
      type: "error",
    },
    {
      inputs: [],
      name: "MemberNotApproved",
      type: "error",
    },
    {
      inputs: [],
      name: "NotAdmin",
      type: "error",
    },
    {
      inputs: [],
      name: "NotAuthorizedToKick",
      type: "error",
    },
    {
      inputs: [],
      name: "NotBlacklisted",
      type: "error",
    },
    {
      inputs: [],
      name: "NotInitializing",
      type: "error",
    },
    {
      inputs: [],
      name: "NotMember",
      type: "error",
    },
    {
      inputs: [],
      name: "NotTrader",
      type: "error",
    },
    {
      inputs: [],
      name: "ReentrancyGuardReentrantCall",
      type: "error",
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "token",
          type: "address",
        },
      ],
      name: "SafeERC20FailedOperation",
      type: "error",
    },
    {
      inputs: [],
      name: "SlippageExceeded",
      type: "error",
    },
    {
      inputs: [],
      name: "SwapAmountTooLarge",
      type: "error",
    },
    {
      inputs: [],
      name: "SwapFailed",
      type: "error",
    },
    {
      inputs: [],
      name: "TokenNotWhitelisted",
      type: "error",
    },
    {
      inputs: [],
      name: "TraderCannotKickTrader",
      type: "error",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "addr",
          type: "address",
        },
        {
          indexed: true,
          internalType: "address",
          name: "blacklistedBy",
          type: "address",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "timestamp",
          type: "uint256",
        },
      ],
      name: "AddressBlacklisted",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "addr",
          type: "address",
        },
        {
          indexed: true,
          internalType: "address",
          name: "unblacklistedBy",
          type: "address",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "timestamp",
          type: "uint256",
        },
      ],
      name: "AddressUnblacklisted",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "member",
          type: "address",
        },
        {
          indexed: true,
          internalType: "address",
          name: "token",
          type: "address",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "amount",
          type: "uint256",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "newTotal",
          type: "uint256",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "timestamp",
          type: "uint256",
        },
      ],
      name: "DepositMade",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "closedBy",
          type: "address",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "finalBalance",
          type: "uint256",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "totalMembers",
          type: "uint256",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "timestamp",
          type: "uint256",
        },
      ],
      name: "GroupClosed",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "enum IJumpaGroup.GroupState",
          name: "oldState",
          type: "uint8",
        },
        {
          indexed: true,
          internalType: "enum IJumpaGroup.GroupState",
          name: "newState",
          type: "uint8",
        },
        {
          indexed: true,
          internalType: "address",
          name: "changedBy",
          type: "address",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "timestamp",
          type: "uint256",
        },
      ],
      name: "GroupStateChanged",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: false,
          internalType: "uint64",
          name: "version",
          type: "uint64",
        },
      ],
      name: "Initialized",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: false,
          internalType: "uint8",
          name: "oldSlippage",
          type: "uint8",
        },
        {
          indexed: false,
          internalType: "uint8",
          name: "newSlippage",
          type: "uint8",
        },
        {
          indexed: true,
          internalType: "address",
          name: "updatedBy",
          type: "address",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "timestamp",
          type: "uint256",
        },
      ],
      name: "MaxSlippageUpdated",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: false,
          internalType: "uint8",
          name: "oldPercentage",
          type: "uint8",
        },
        {
          indexed: false,
          internalType: "uint8",
          name: "newPercentage",
          type: "uint8",
        },
        {
          indexed: true,
          internalType: "address",
          name: "updatedBy",
          type: "address",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "timestamp",
          type: "uint256",
        },
      ],
      name: "MaxSwapPercentageUpdated",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "member",
          type: "address",
        },
        {
          indexed: true,
          internalType: "address",
          name: "approvedBy",
          type: "address",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "timestamp",
          type: "uint256",
        },
      ],
      name: "MemberApproved",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "member",
          type: "address",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "withdrawal",
          type: "uint256",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "contribution",
          type: "uint256",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "timestamp",
          type: "uint256",
        },
      ],
      name: "MemberExited",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "member",
          type: "address",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "contribution",
          type: "uint256",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "timestamp",
          type: "uint256",
        },
      ],
      name: "MemberJoined",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "member",
          type: "address",
        },
        {
          indexed: true,
          internalType: "address",
          name: "kickedBy",
          type: "address",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "withdrawal",
          type: "uint256",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "contribution",
          type: "uint256",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "timestamp",
          type: "uint256",
        },
      ],
      name: "MemberKicked",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: false,
          internalType: "uint256",
          name: "oldMinimum",
          type: "uint256",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "newMinimum",
          type: "uint256",
        },
        {
          indexed: true,
          internalType: "address",
          name: "updatedBy",
          type: "address",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "timestamp",
          type: "uint256",
        },
      ],
      name: "MinimumDepositUpdated",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "previousOwner",
          type: "address",
        },
        {
          indexed: true,
          internalType: "address",
          name: "newOwner",
          type: "address",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "timestamp",
          type: "uint256",
        },
      ],
      name: "OwnershipTransferred",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: false,
          internalType: "address",
          name: "account",
          type: "address",
        },
      ],
      name: "Paused",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "trader",
          type: "address",
        },
        {
          indexed: true,
          internalType: "address",
          name: "recipient",
          type: "address",
        },
        {
          indexed: false,
          internalType: "address",
          name: "token",
          type: "address",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "amount",
          type: "uint256",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "actualAmount",
          type: "uint256",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "timestamp",
          type: "uint256",
        },
      ],
      name: "ProfitDistributed",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "trader",
          type: "address",
        },
        {
          indexed: false,
          internalType: "address",
          name: "tokenIn",
          type: "address",
        },
        {
          indexed: false,
          internalType: "address",
          name: "tokenOut",
          type: "address",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "amountIn",
          type: "uint256",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "amountOut",
          type: "uint256",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "minAmountOut",
          type: "uint256",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "timestamp",
          type: "uint256",
        },
      ],
      name: "SwapExecuted",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "trader",
          type: "address",
        },
        {
          indexed: true,
          internalType: "address",
          name: "addedBy",
          type: "address",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "timestamp",
          type: "uint256",
        },
      ],
      name: "TraderAdded",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "trader",
          type: "address",
        },
        {
          indexed: true,
          internalType: "address",
          name: "removedBy",
          type: "address",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "timestamp",
          type: "uint256",
        },
      ],
      name: "TraderRemoved",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: false,
          internalType: "address",
          name: "account",
          type: "address",
        },
      ],
      name: "Unpaused",
      type: "event",
    },
    {
      inputs: [],
      name: "DEFAULT_MINIMUM_DEPOSIT",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [],
      name: "MAX_BLACKLIST",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [],
      name: "MAX_MEMBERS",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [],
      name: "MAX_NAME_LEN",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [],
      name: "MAX_TRADERS",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [],
      name: "MIN_NAME_LEN",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "addr",
          type: "address",
        },
      ],
      name: "addToBlacklist",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "trader",
          type: "address",
        },
      ],
      name: "addTrader",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "member",
          type: "address",
        },
      ],
      name: "approveMember",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [],
      name: "closeGroup",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "token",
          type: "address",
        },
        {
          internalType: "uint256",
          name: "",
          type: "uint256",
        },
      ],
      name: "deposit",
      outputs: [],
      stateMutability: "payable",
      type: "function",
    },
    {
      inputs: [],
      name: "distributeProfit",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [
        {
          components: [
            {
              internalType: "address",
              name: "tokenIn",
              type: "address",
            },
            {
              internalType: "address",
              name: "tokenOut",
              type: "address",
            },
            {
              internalType: "uint256",
              name: "amountIn",
              type: "uint256",
            },
            {
              internalType: "uint256",
              name: "minAmountOut",
              type: "uint256",
            },
            {
              internalType: "bytes",
              name: "swapData",
              type: "bytes",
            },
          ],
          internalType: "struct IJumpaGroup.SwapParams",
          name: "params",
          type: "tuple",
        },
      ],
      name: "executeSwap",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [],
      name: "exitGroup",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [],
      name: "getApprovedMembersCount",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [],
      name: "getFactory",
      outputs: [
        {
          internalType: "address",
          name: "",
          type: "address",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [],
      name: "getGroupInfo",
      outputs: [
        {
          components: [
            {
              internalType: "address",
              name: "owner",
              type: "address",
            },
            {
              internalType: "uint8",
              name: "maxSlippagePercentage",
              type: "uint8",
            },
            {
              internalType: "uint8",
              name: "maxSwapPercentage",
              type: "uint8",
            },
            {
              internalType: "bool",
              name: "isPrivate",
              type: "bool",
            },
            {
              internalType: "enum IJumpaGroup.GroupState",
              name: "state",
              type: "uint8",
            },
            {
              internalType: "string",
              name: "name",
              type: "string",
            },
            {
              internalType: "address[]",
              name: "traders",
              type: "address[]",
            },
            {
              internalType: "address[]",
              name: "members",
              type: "address[]",
            },
            {
              internalType: "address[]",
              name: "blacklist",
              type: "address[]",
            },
            {
              internalType: "uint256",
              name: "minimumDeposit",
              type: "uint256",
            },
            {
              internalType: "uint256",
              name: "totalContributions",
              type: "uint256",
            },
            {
              internalType: "uint256",
              name: "createdAt",
              type: "uint256",
            },
          ],
          internalType: "struct IJumpaGroup.GroupInfo",
          name: "",
          type: "tuple",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "member",
          type: "address",
        },
      ],
      name: "getMemberProfile",
      outputs: [
        {
          components: [
            {
              internalType: "uint256",
              name: "contributionAmount",
              type: "uint256",
            },
            {
              internalType: "uint256",
              name: "joinedAt",
              type: "uint256",
            },
            {
              internalType: "bool",
              name: "isApproved",
              type: "bool",
            },
          ],
          internalType: "struct IJumpaGroup.MemberProfile",
          name: "",
          type: "tuple",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [],
      name: "getPendingMembers",
      outputs: [
        {
          internalType: "address[]",
          name: "",
          type: "address[]",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "token",
          type: "address",
        },
      ],
      name: "getTokenBalance",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "factory",
          type: "address",
        },
        {
          internalType: "address",
          name: "owner",
          type: "address",
        },
        {
          internalType: "string",
          name: "groupName",
          type: "string",
        },
        {
          internalType: "bool",
          name: "isPrivate",
          type: "bool",
        },
      ],
      name: "initialize",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [],
      name: "joinGroup",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "member",
          type: "address",
        },
      ],
      name: "kickMember",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [],
      name: "paused",
      outputs: [
        {
          internalType: "bool",
          name: "",
          type: "bool",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "addr",
          type: "address",
        },
      ],
      name: "removeFromBlacklist",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "trader",
          type: "address",
        },
      ],
      name: "removeTrader",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "enum IJumpaGroup.GroupState",
          name: "newState",
          type: "uint8",
        },
      ],
      name: "setGroupState",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "uint8",
          name: "newSlippage",
          type: "uint8",
        },
      ],
      name: "setMaxSlippage",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "uint8",
          name: "newPercentage",
          type: "uint8",
        },
      ],
      name: "setMaxSwapPercentage",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "newMinimum",
          type: "uint256",
        },
      ],
      name: "setMinimumDeposit",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "newOwner",
          type: "address",
        },
      ],
      name: "transferOwnership",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      stateMutability: "payable",
      type: "receive",
    },
  ],
};
