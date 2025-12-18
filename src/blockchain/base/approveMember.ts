//Approve a pending member in the JumpaGroup contract
import { Contract, ethers, Wallet } from "ethers";
import { jumpaGroupAbi } from "./JumpaGroupAbi";
import { config } from "@core/config/environment";
import getUser from "@features/users/getUserInfo";
import { Context } from "telegraf";
import { decryptPrivateKey } from "@shared/utils/encryption";

const provider = new ethers.JsonRpcProvider(config.evmRpcUrl);

/** Approve a pending member
 * Requires the group address, member address, and user context
 * Calls the approveMember function and returns the MemberApproved event data
 */

export const approveMember = async (
  ctx: Context,
  address: string,
  memberAddress: string
) => {
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

  const contractAddress = address;
  const contract = new Contract(contractAddress, jumpaGroupAbi.abi, provider);
  const contractWithSigner = new Contract(
    contractAddress,
    jumpaGroupAbi.abi,
    wallet
  );

  try {
    // Call approveMember function
    const approveTx = await contractWithSigner.approveMember(memberAddress);
    console.log("---- Approve Member Transaction ----", approveTx);

    // Wait for transaction to be mined
    const receipt = await approveTx.wait();
    console.log("---- Approve Member Receipt ----", receipt);

    // Extract MemberApproved event from transaction receipt
    const memberApprovedEvent = receipt.logs.find((log: any) => {
      try {
        const parsedLog = contract.interface.parseLog(log);
        return parsedLog?.name === "MemberApproved";
      } catch {
        return false;
      }
    });

    if (memberApprovedEvent) {
      const parsedEvent = contract.interface.parseLog(memberApprovedEvent);
      const member = parsedEvent?.args.member;
      const approvedBy = parsedEvent?.args.approvedBy;
      const timestamp = parsedEvent?.args.timestamp;

      console.log("---- Member Approved Event ----");
      console.log("Member:", member);
      console.log("Approved By:", approvedBy);
      console.log("Timestamp:", timestamp?.toString());

      return {
        success: true,
        data: {
          member: member as string,
          approvedBy: approvedBy as string,
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
    console.log("short error msg", error.code);
    console.log("detailed error 2", error);
    return {
      success: false,
      data: error.code,
    };
  }
};
