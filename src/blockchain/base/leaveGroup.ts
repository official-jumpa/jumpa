//Exit/leave a group on the JumpaGroup contract
import { Contract, ethers, Wallet } from "ethers";
import { jumpaGroupAbi } from "./JumpaGroupAbi";
import { config } from "@core/config/environment";
import getUser from "@features/users/getUserInfo";
import { Context } from "telegraf";
import { decryptPrivateKey } from "@shared/utils/encryption";

const provider = new ethers.JsonRpcProvider(config.evmRpcUrl);

/** Exit/leave a base group
 * Requires the group address and user context
 * Calls the exitGroup function and returns the MemberExited event data
*/

export const LeaveBaseGroup = async (ctx: Context, address: string) => {
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
    // Call exitGroup function - this is a transaction, not a view function
    const exitTx = await contractWithSigner.exitGroup();
    console.log("---- Exit Group Transaction ----", exitTx);

    // Wait for transaction to be mined
    const receipt = await exitTx.wait();
    console.log("---- Exit Group Receipt ----", receipt);

    // Extract MemberExited event from transaction receipt
    const memberExitedEvent = receipt.logs.find((log: any) => {
      try {
        const parsedLog = contract.interface.parseLog(log);
        return parsedLog?.name === "MemberExited";
      } catch {
        return false;
      }
    });

    if (memberExitedEvent) {
      const parsedEvent = contract.interface.parseLog(memberExitedEvent);
      const member = parsedEvent?.args.member;
      const withdrawal = parsedEvent?.args.withdrawal;
      const contribution = parsedEvent?.args.contribution;
      const timestamp = parsedEvent?.args.timestamp;

      console.log("---- Member Exited Event ----");
      console.log("Member:", member);
      console.log("Withdrawal:", withdrawal?.toString());
      console.log("Contribution:", contribution?.toString());
      console.log("Timestamp:", timestamp?.toString());

      return {
        success: true,
        data: {
          member: member as string,
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
    // console.error("Error exiting group:", error);
    console.log("short error msg", error.code);
    console.log("detailed error 2", error);
    return {
      success: false,
      data: error.code,
    };
  }
};
