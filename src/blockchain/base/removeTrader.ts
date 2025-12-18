//Remove trader from the JumpaGroup contract
import { Contract, ethers, Wallet } from "ethers";
import { jumpaGroupAbi } from "./JumpaGroupAbi";
import { config } from "@core/config/config";
import getUser from "@modules/users/getUserInfo";
import { Context } from "telegraf";
import { decryptPrivateKey } from "@shared/utils/encryption";

const provider = new ethers.JsonRpcProvider(config.evmRpcUrl);

/** Remove a trader from the group
 * Requires the group address, trader address, and user context
 * Calls the removeTrader function and returns the TraderRemoved event data
 */

export const removeTrader = async (
  ctx: Context,
  address: string,
  traderAddress: string
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
    // Call removeTrader function
    const removeTraderTx = await contractWithSigner.removeTrader(traderAddress);
    console.log("---- Remove Trader Transaction ----", removeTraderTx);

    // Wait for transaction to be mined
    const receipt = await removeTraderTx.wait();
    console.log("---- Remove Trader Receipt ----", receipt);

    // Extract TraderRemoved event from transaction receipt
    const traderRemovedEvent = receipt.logs.find((log: any) => {
      try {
        const parsedLog = contract.interface.parseLog(log);
        return parsedLog?.name === "TraderRemoved";
      } catch {
        return false;
      }
    });

    if (traderRemovedEvent) {
      const parsedEvent = contract.interface.parseLog(traderRemovedEvent);
      const trader = parsedEvent?.args.trader;
      const removedBy = parsedEvent?.args.removedBy;
      const timestamp = parsedEvent?.args.timestamp;

      console.log("---- Trader Removed Event ----");
      console.log("Trader:", trader);
      console.log("Removed By:", removedBy);
      console.log("Timestamp:", timestamp?.toString());

      return {
        success: true,
        data: {
          trader: trader as string,
          removedBy: removedBy as string,
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
