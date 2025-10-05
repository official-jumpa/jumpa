import AjoGroup from "../models/ajoGroup";
import User from "../models/user";
import { Types } from "mongoose";

export interface CreateAjoParams {
  name: string;
  creator_id: number;
  telegram_chat_id: number;
  initial_capital: number;
  max_members: number;
  consensus_threshold?: number;
}

export interface JoinAjoParams {
  group_id: string;
  user_id: number;
  contribution?: number;
}

export interface CreatePollParams {
  group_id: string;
  creator_id: number;
  type: "trade" | "end_ajo";
  title: string;
  token_address?: string;
  token_symbol?: string;
  amount?: number;
  expires_hours?: number;
}

export interface VoteParams {
  group_id: string;
  poll_id: string;
  user_id: number;
  vote: boolean;
}

/**
 * Create a new Ajo group
 */
export async function createAjo(params: CreateAjoParams) {
  try {
    // Validate creator exists
    const creator = await User.findOne({ telegram_id: params.creator_id });
    if (!creator) {
      throw new Error("Creator not found. Please register first.");
    }

    // Validate parameters
    if (params.max_members < 2 || params.max_members > 100) {
      throw new Error("Max members must be between 2 and 100");
    }

    if (params.initial_capital < 0) {
      throw new Error("Initial capital must be non-negative");
    }

    const consensus_threshold = params.consensus_threshold || 67;
    if (consensus_threshold < 50 || consensus_threshold > 100) {
      throw new Error("Consensus threshold must be between 50% and 100%");
    }

    // Check if chat already has an ajo group
    const existingGroup = await AjoGroup.findOne({
      telegram_chat_id: params.telegram_chat_id,
    });
    if (existingGroup) {
      throw new Error("This chat already has an Ajo group");
    }

    // Create the ajo group
    const ajoGroup = new AjoGroup({
      name: params.name,
      creator_id: params.creator_id,
      telegram_chat_id: params.telegram_chat_id,
      initial_capital: params.initial_capital,
      max_members: params.max_members,
      consensus_threshold: consensus_threshold,
      status: "active",
      members: [
        {
          user_id: params.creator_id,
          role: "trader", // Creator is automatically a trader
          contribution: 0, // Will be updated when they contribute
          joined_at: new Date(),
        },
      ],
      polls: [],
      trades: [],
      current_balance: 0,
    });

    await ajoGroup.save();

    console.log(`Ajo group created: ${params.name} (ID: ${ajoGroup._id})`);
    return ajoGroup;
  } catch (error) {
    console.error("Error creating ajo group:", error);
    throw error;
  }
}

/**
 * Join an existing Ajo group
 */
export async function joinAjo(params: JoinAjoParams) {
  try {
    // Validate user exists
    const user = await User.findOne({ telegram_id: params.user_id });
    if (!user) {
      throw new Error("User not found. Please register first.");
    }

    // Find the ajo group
    const ajoGroup = await AjoGroup.findById(params.group_id);
    if (!ajoGroup) {
      throw new Error("Ajo group not found");
    }

    // Check if group is active
    if (ajoGroup.status !== "active") {
      throw new Error("This Ajo group is not accepting new members");
    }

    // Check if user is already a member
    const existingMember = ajoGroup.members.find(
      (member) => member.user_id === params.user_id
    );
    if (existingMember) {
      throw new Error("You are already a member of this Ajo group");
    }

    // Check if group has space
    if (ajoGroup.members.length >= ajoGroup.max_members) {
      throw new Error("This Ajo group is full");
    }

    // Add user as member
    ajoGroup.members.push({
      user_id: params.user_id,
      role: "member", // New members start as regular members
      contribution: params.contribution || 0,
      joined_at: new Date(),
    });

    await ajoGroup.save();

    console.log(`User ${params.user_id} joined ajo group ${params.group_id}`);
    return ajoGroup;
  } catch (error) {
    console.error("Error joining ajo group:", error);
    throw error;
  }
}

/**
 * Get Ajo group information
 */
export async function getAjoInfo(group_id: string) {
  try {
    const ajoGroup = await AjoGroup.findById(group_id);
    if (!ajoGroup) {
      throw new Error("Ajo group not found");
    }

    return ajoGroup;
  } catch (error) {
    console.error("Error getting ajo group info:", error);
    throw error;
  }
}

/**
 * Get Ajo group by telegram chat ID
 */
export async function getAjoByChatId(telegram_chat_id: number) {
  try {
    const ajoGroup = await AjoGroup.findOne({ telegram_chat_id });
    return ajoGroup;
  } catch (error) {
    console.error("Error getting ajo group by chat ID:", error);
    throw error;
  }
}

/**
 * Update Ajo group status
 */
export async function updateAjoStatus(
  group_id: string,
  status: "active" | "ended"
) {
  try {
    const ajoGroup = await AjoGroup.findByIdAndUpdate(
      group_id,
      { status },
      { new: true }
    );

    if (!ajoGroup) {
      throw new Error("Ajo group not found");
    }

    console.log(`Ajo group ${group_id} status updated to ${status}`);
    return ajoGroup;
  } catch (error) {
    console.error("Error updating ajo group status:", error);
    throw error;
  }
}

/**
 * Get user's Ajo groups
 */
export async function getUserAjoGroups(user_id: number) {
  try {
    const ajoGroups = await AjoGroup.find({
      "members.user_id": user_id,
    });

    return ajoGroups;
  } catch (error) {
    console.error("Error getting user ajo groups:", error);
    throw error;
  }
}

/**
 * Check if user is member of ajo group
 */
export async function isUserMember(group_id: string, user_id: number) {
  try {
    const ajoGroup = await AjoGroup.findById(group_id);
    if (!ajoGroup) {
      return false;
    }

    return ajoGroup.members.some((member) => member.user_id === user_id);
  } catch (error) {
    console.error("Error checking user membership:", error);
    return false;
  }
}

/**
 * Check if user is trader in ajo group
 */
export async function isUserTrader(group_id: string, user_id: number) {
  try {
    const ajoGroup = await AjoGroup.findById(group_id);
    if (!ajoGroup) {
      return false;
    }

    const member = ajoGroup.members.find(
      (member) => member.user_id === user_id
    );
    return member ? member.role === "trader" : false;
  } catch (error) {
    console.error("Error checking user trader status:", error);
    return false;
  }
}

/**
 * Update member contribution
 */
export async function updateMemberContribution(
  group_id: string,
  user_id: number,
  contribution: number
) {
  try {
    const ajoGroup = await AjoGroup.findById(group_id);
    if (!ajoGroup) {
      throw new Error("Ajo group not found");
    }

    const memberIndex = ajoGroup.members.findIndex(
      (member) => member.user_id === user_id
    );
    if (memberIndex === -1) {
      throw new Error("User is not a member of this group");
    }

    ajoGroup.members[memberIndex].contribution = contribution;

    // Update group balance
    ajoGroup.current_balance = ajoGroup.members.reduce(
      (total, member) => total + member.contribution,
      0
    );

    await ajoGroup.save();

    console.log(
      `Updated contribution for user ${user_id} in group ${group_id}`
    );
    return ajoGroup;
  } catch (error) {
    console.error("Error updating member contribution:", error);
    throw error;
  }
}

/**
 * Promote member to trader
 */
export async function promoteToTrader(group_id: string, user_id: number) {
  try {
    const ajoGroup = await AjoGroup.findById(group_id);
    if (!ajoGroup) {
      throw new Error("Ajo group not found");
    }

    const memberIndex = ajoGroup.members.findIndex(
      (member) => member.user_id === user_id
    );
    if (memberIndex === -1) {
      throw new Error("User is not a member of this group");
    }

    ajoGroup.members[memberIndex].role = "trader";
    await ajoGroup.save();

    console.log(`User ${user_id} promoted to trader in group ${group_id}`);
    return ajoGroup;
  } catch (error) {
    console.error("Error promoting user to trader:", error);
    throw error;
  }
}

/**
 * Remove member from ajo group
 */
export async function removeMember(group_id: string, user_id: number) {
  try {
    const ajoGroup = await AjoGroup.findById(group_id);
    if (!ajoGroup) {
      throw new Error("Ajo group not found");
    }

    // Don't allow removing the creator
    if (ajoGroup.creator_id === user_id) {
      throw new Error("Cannot remove the group creator");
    }

    const memberIndex = ajoGroup.members.findIndex(
      (member) => member.user_id === user_id
    );
    if (memberIndex === -1) {
      throw new Error("User is not a member of this group");
    }

    // Remove member and update balance
    const memberContribution = ajoGroup.members[memberIndex].contribution;
    ajoGroup.members.splice(memberIndex, 1);
    ajoGroup.current_balance -= memberContribution;

    await ajoGroup.save();

    console.log(`User ${user_id} removed from group ${group_id}`);
    return ajoGroup;
  } catch (error) {
    console.error("Error removing member:", error);
    throw error;
  }
}
