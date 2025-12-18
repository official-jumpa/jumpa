//Join a group on the JumpaGroup contract
import { Contract, ethers, Wallet } from "ethers";
import { jumpaGroupAbi } from "./JumpaGroupAbi";
import { config } from "@core/config/config";
import getUser from "@modules/users/getUserInfo";
import { Context } from "telegraf";
import { decryptPrivateKey } from "@shared/utils/encryption";

const provider = new ethers.JsonRpcProvider(config.evmRpcUrl);

/** Join a base group
 * Requires the group address and user context
 * Calls the joinGroup function and returns the MemberJoined event data
*/

export const JoinBaseGroup = async (ctx: Context, address: string) => {
  const userId = ctx.from?.id;

  if (!userId) {
    await ctx.reply("❌ Unable to identify user.");
    return { success: false, data: "User not identified" };
  }

  // Verify user and get wallet
  const user = await getUser(userId, ctx.from?.username);
  if (!user) {
    await ctx.reply("❌ Please register first using /start");
    return { success: false, data: "User not registered" };
  } else if (!user.evmWallets[0].address) {
    await ctx.reply("❌ Please create a new EVM wallet");
    return { success: false, data: "Wallet not linked" };
  }

  const pkey = user.evmWallets[0].encryptedPrivateKey;
  const decryptedKey = decryptPrivateKey(pkey);
  const wallet = new Wallet(decryptedKey, provider);

  const contractAddress = address; //always interact with the user's created group trading CA
  const contract = new Contract(contractAddress, jumpaGroupAbi.abi, provider);
  const contractWithSigner = new Contract(
    contractAddress,
    jumpaGroupAbi.abi,
    wallet
  );

  try {
    // Call joinGroup function - this is a transaction, not a view function
    const joinTx = await contractWithSigner.joinGroup();
    console.log("---- Join Group Transaction ----", joinTx);

    // Wait for transaction to be mined
    const receipt = await joinTx.wait();
    console.log("---- Join Group Receipt ----", receipt);

    // Extract MemberJoined event from transaction receipt
    const memberJoinedEvent = receipt.logs.find((log: any) => {
      try {
        const parsedLog = contract.interface.parseLog(log);
        return parsedLog?.name === "MemberJoined";
      } catch {
        return false;
      }
    });

    if (memberJoinedEvent) {
      const parsedEvent = contract.interface.parseLog(memberJoinedEvent);
      const member = parsedEvent?.args.member;
      const contribution = parsedEvent?.args.contribution;
      const timestamp = parsedEvent?.args.timestamp;

      console.log("---- Member Joined Event ----");
      console.log("Member:", member);
      console.log("Contribution:", contribution?.toString());
      console.log("Timestamp:", timestamp?.toString());

      return {
        success: true,
        data: {
          member: member as string,
          contribution: contribution?.toString(),
          timestamp: timestamp?.toString(),
          hash: receipt.hash,
          blockNumber: receipt.blockNumber,
        },
      };
    }

    // Fallback if event not found
    return {
      success: true,
      data: { hash: receipt.hash, blockNumber: receipt.blockNumber },
    };
  } catch (error) {
    // console.error("Error joining group:", error);
    console.log("short error msg", error.code);
    console.log("detailed error 2", error);
    return {
      success: false,
      data: error.code,
    };
  }
};
