//Close the JumpaGroup contract
import { Contract, ethers, Wallet } from "ethers";
import { jumpaGroupAbi } from "./JumpaGroupAbi";
import { config } from "@core/config/config";
import getUser from "@modules/users/getUserInfo";
import { Context } from "telegraf";
import { decryptPrivateKey } from "@shared/utils/encryption";

const provider = new ethers.JsonRpcProvider(config.evmRpcUrl);

/** Close the group permanently
 * Requires the group address and user context
 * Calls the closeGroup function and returns the GroupClosed event data
 */

export const closeGroup = async (ctx: Context, address: string) => {
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
    // Call closeGroup function
    const closeTx = await contractWithSigner.closeGroup();
    console.log("---- Close Group Transaction ----", closeTx);

    // Wait for transaction to be mined
    const receipt = await closeTx.wait();
    console.log("---- Close Group Receipt ----", receipt);

    // Extract GroupClosed event from transaction receipt
    const groupClosedEvent = receipt.logs.find((log: any) => {
      try {
        const parsedLog = contract.interface.parseLog(log);
        return parsedLog?.name === "GroupClosed";
      } catch {
        return false;
      }
    });

    if (groupClosedEvent) {
      const parsedEvent = contract.interface.parseLog(groupClosedEvent);
      const closedBy = parsedEvent?.args.closedBy;
      const finalBalance = parsedEvent?.args.finalBalance;
      const totalMembers = parsedEvent?.args.totalMembers;
      const timestamp = parsedEvent?.args.timestamp;

      console.log("---- Group Closed Event ----");
      console.log("Closed By:", closedBy);
      console.log("Final Balance:", finalBalance?.toString());
      console.log("Total Members:", totalMembers?.toString());
      console.log("Timestamp:", timestamp?.toString());

      return {
        success: true,
        data: {
          closedBy: closedBy as string,
          finalBalance: finalBalance?.toString(),
          totalMembers: totalMembers?.toString(),
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
