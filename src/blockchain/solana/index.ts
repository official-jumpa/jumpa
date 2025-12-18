/**
 * Solana Blockchain Service
 *
 * This file provides a single entry point for all Solana blockchain operations.
 * All functions are properly typed and can be imported individually or as a group.
 */

// ===== SERVICE =====
export { SolanaBlockchainService } from "./SolanaBlockchainService";

// ===== UTILITIES =====
export {
  getProviderForUser,
  getProgram,
  deriveGroupPDA,
  deriveMemberProfilePDA,
  checkGroupExists,
  checkWalletBalance,
  PROGRAM_ID,
  GROUP_SEED,
  MEMBER_SEED
} from "./utils";

// ===== GROUP MANAGEMENT =====
export { createGroup, type CreateGroupParams } from "./createGroup";
export { joinGroup, type JoinGroupParams } from "./joinGroup";
export { exitGroup, type ExitGroupParams } from "./exitGroup";
export { closeGroup, type CloseGroupParams } from "./closeGroup";

// ===== TRADER MANAGEMENT =====
export {
  addTrader,
  removeTrader,
  type AddTraderParams,
  type RemoveTraderParams
} from "./manageTraders";

// ===== FINANCIAL OPERATIONS =====
export { deposit, type DepositParams } from "./deposit";
export { distributeProfit, type DistributeProfitParams } from "./distributeProfit";

// ===== MEMBER MANAGEMENT =====
export { kickMember, type KickMemberParams } from "./kickMember";

// ===== BLACKLIST MANAGEMENT =====
export {
  addToBlacklist,
  removeFromBlacklist,
  type AddToBlacklistParams,
  type RemoveFromBlacklistParams
} from "./manageBlacklist";

// ===== GROUP SETTINGS =====
export {
  setExitPenalty,
  setMinimumDeposit,
  type SetExitPenaltyParams,
  type SetMinimumDepositParams
} from "./groupSettings";

// ===== DATA FETCHING =====
export {
  fetchGroupAccount,
  fetchMemberProfile
} from "./fetchData";
