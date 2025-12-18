//Set max swap percentage in the JumpaGroup contract
import { Contract, ethers, Wallet } from "ethers";
import { jumpaGroupAbi } from "./JumpaGroupAbi";
import { config } from "@core/config/config";
import getUser from "@modules/users/getUserInfo";
import { Context } from "telegraf";
import { decryptPrivateKey } from "@shared/utils/encryption";

const provider = new ethers.JsonRpcProvider(config.evmRpcUrl);

/** Set the maximum swap percentage
 * Requires the group address, new swap percentage, and user context
 * Calls the setMaxSwapPercentage function and returns the MaxSwapPercentageUpdated event data
 */

export const setMaxSwapPercentage = async (
  ctx: Context,
  address: string,
  newPercentage: number
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
    // Call setMaxSwapPercentage function
    const setPercentageTx = await contractWithSigner.setMaxSwapPercentage(newPercentage);
    console.log("---- Set Max Swap Percentage Transaction ----", setPercentageTx);

    // Wait for transaction to be mined
    const receipt = await setPercentageTx.wait();
    console.log("---- Set Max Swap Percentage Receipt ----", receipt);

    // Extract MaxSwapPercentageUpdated event from transaction receipt
    const maxSwapPercentageUpdatedEvent = receipt.logs.find((log: any) => {
      try {
        const parsedLog = contract.interface.parseLog(log);
        return parsedLog?.name === "MaxSwapPercentageUpdated";
      } catch {
        return false;
      }
    });

    if (maxSwapPercentageUpdatedEvent) {
      const parsedEvent = contract.interface.parseLog(maxSwapPercentageUpdatedEvent);
      const oldPercentage = parsedEvent?.args.oldPercentage;
      const newPercentageResult = parsedEvent?.args.newPercentage;
      const updatedBy = parsedEvent?.args.updatedBy;
      const timestamp = parsedEvent?.args.timestamp;

      console.log("---- Max Swap Percentage Updated Event ----");
      console.log("Old Percentage:", Number(oldPercentage));
      console.log("New Percentage:", Number(newPercentageResult));
      console.log("Updated By:", updatedBy);
      console.log("Timestamp:", timestamp?.toString());

      return {
        success: true,
        data: {
          oldPercentage: Number(oldPercentage),
          newPercentage: Number(newPercentageResult),
          updatedBy: updatedBy as string,
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
