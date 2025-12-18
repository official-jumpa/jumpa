import Group from "@database/models/group";

/**
 * Group Service
 * Centralized service for group-related database operations
 */
export class GroupService {
  /**
   * Get group by telegram chat ID
   */
  static async getGroupByChatId(telegram_chat_id: number) {
    try {
      const group = await Group.findOne({ telegram_chat_id });
      return group;
    } catch (error) {
      console.error("Error getting group by chat ID:", error);
      throw error;
    }
  }

  /**
   * Get user's groups
   */
  static async getUserGroups(user_id: number) {
    try {
      const groups = await Group.find({
        "members.user_id": user_id,
      });
      return groups;
    } catch (error) {
      console.error("Error getting user groups:", error);
      throw error;
    }
  }

  /**
   * Check if user is member of group
   */
  static async isUserMember(group_id: string, user_id: number) {
    try {
      const group = await Group.findById(group_id);
      if (!group) {
        return false;
      }
      return group.members.some((member: any) => member.user_id === user_id);
    } catch (error) {
      console.error("Error checking user membership:", error);
      return false;
    }
  }

  /**
   * Check if user is trader in group
   */
  static async isUserTrader(group_id: string, user_id: number) {
    try {
      const group = await Group.findById(group_id);
      if (!group) {
        return false;
      }
      const member = group.members.find(
        (member: any) => member.user_id === user_id
      );
      // Check if member has trader role (using type assertion for optional field)
      return (member as any)?.role === "trader" || false;
    } catch (error) {
      console.error("Error checking user trader status:", error);
      return false;
    }
  }

  /**
   * Get group information by ID
   */
  static async getGroupInfo(group_id: string) {
    try {
      const group = await Group.findById(group_id);
      if (!group) {
        throw new Error("Group not found");
      }
      return group;
    } catch (error) {
      console.error("Error getting group info:", error);
      throw error;
    }
  }
}
