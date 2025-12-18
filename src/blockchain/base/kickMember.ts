//Kick a member from the JumpaGroup contract
import { Contract, ethers, Wallet } from "ethers";
import { jumpaGroupAbi } from "./JumpaGroupAbi";
import { config } from "@core/config/config";
import getUser from "@modules/users/getUserInfo";
import { Context } from "telegraf";
import { decryptPrivateKey } from "@shared/utils/encryption";

const provider = new ethers.JsonRpcProvider(config.evmRpcUrl);

/** Kick a member from the group
 * Requires the group address, member address, and user context
 * Calls the kickMember function and returns the MemberKicked event data
 */

export const kickMember = async (
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
    // Call kickMember function
    const kickTx = await contractWithSigner.kickMember(memberAddress);
    console.log("---- Kick Member Transaction ----", kickTx);

    // Wait for transaction to be mined
    const receipt = await kickTx.wait();
    console.log("---- Kick Member Receipt ----", receipt);

    // Extract MemberKicked event from transaction receipt
    const memberKickedEvent = receipt.logs.find((log: any) => {
      try {
        const parsedLog = contract.interface.parseLog(log);
        return parsedLog?.name === "MemberKicked";
      } catch {
        return false;
      }
    });

    if (memberKickedEvent) {
      const parsedEvent = contract.interface.parseLog(memberKickedEvent);
      const member = parsedEvent?.args.member;
      const kickedBy = parsedEvent?.args.kickedBy;
      const withdrawal = parsedEvent?.args.withdrawal;
      const contribution = parsedEvent?.args.contribution;
      const timestamp = parsedEvent?.args.timestamp;

      console.log("---- Member Kicked Event ----");
      console.log("Member:", member);
      console.log("Kicked By:", kickedBy);
      console.log("Withdrawal:", withdrawal?.toString());
      console.log("Contribution:", contribution?.toString());
      console.log("Timestamp:", timestamp?.toString());

      return {
        success: true,
        data: {
          member: member as string,
          kickedBy: kickedBy as string,
          withdrawal: withdrawal?.toString(),
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
    console.log("short error msg", error.code);
    console.log("detailed error 2", error);
    return {
      success: false,
      data: error.code,
    };
  }
};
