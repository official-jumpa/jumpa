//Set max slippage in the JumpaGroup contract
import { Contract, ethers, Wallet } from "ethers";
import { jumpaGroupAbi } from "./JumpaGroupAbi";
import { config } from "@core/config/config";
import getUser from "@modules/users/getUserInfo";
import { Context } from "telegraf";
import { decryptPrivateKey } from "@shared/utils/encryption";

const provider = new ethers.JsonRpcProvider(config.evmRpcUrl);

/** Set the maximum slippage percentage
 * Requires the group address, new slippage percentage, and user context
 * Calls the setMaxSlippage function and returns the MaxSlippageUpdated event data
 */

export const setMaxSlippage = async (
  ctx: Context,
  address: string,
  newSlippage: number
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
    // Call setMaxSlippage function
    const setSlippageTx = await contractWithSigner.setMaxSlippage(newSlippage);
    console.log("---- Set Max Slippage Transaction ----", setSlippageTx);

    // Wait for transaction to be mined
    const receipt = await setSlippageTx.wait();
    console.log("---- Set Max Slippage Receipt ----", receipt);

    // Extract MaxSlippageUpdated event from transaction receipt
    const maxSlippageUpdatedEvent = receipt.logs.find((log: any) => {
      try {
        const parsedLog = contract.interface.parseLog(log);
        return parsedLog?.name === "MaxSlippageUpdated";
      } catch {
        return false;
      }
    });

    if (maxSlippageUpdatedEvent) {
      const parsedEvent = contract.interface.parseLog(maxSlippageUpdatedEvent);
      const oldSlippage = parsedEvent?.args.oldSlippage;
      const newSlippageResult = parsedEvent?.args.newSlippage;
      const updatedBy = parsedEvent?.args.updatedBy;
      const timestamp = parsedEvent?.args.timestamp;

      console.log("---- Max Slippage Updated Event ----");
      console.log("Old Slippage:", Number(oldSlippage));
      console.log("New Slippage:", Number(newSlippageResult));
      console.log("Updated By:", updatedBy);
      console.log("Timestamp:", timestamp?.toString());

      return {
        success: true,
        data: {
          oldSlippage: Number(oldSlippage),
          newSlippage: Number(newSlippageResult),
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
