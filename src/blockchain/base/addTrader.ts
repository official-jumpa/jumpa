//Add trader to the JumpaGroup contract
import { Contract, ethers, Wallet } from "ethers";
import { jumpaGroupAbi } from "./JumpaGroupAbi";
import { config } from "@core/config/config";
import getUser from "@modules/users/getUserInfo";
import { Context } from "telegraf";
import { decryptPrivateKey } from "@shared/utils/encryption";

const provider = new ethers.JsonRpcProvider(config.evmRpcUrl);

/** Add a trader to the group
 * Requires the group address, trader address, and user context
 * Calls the addTrader function and returns the TraderAdded event data
 */

export const addTrader = async (
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
    // Call addTrader function
    const addTraderTx = await contractWithSigner.addTrader(traderAddress);
    console.log("---- Add Trader Transaction ----", addTraderTx);

    // Wait for transaction to be mined
    const receipt = await addTraderTx.wait();
    console.log("---- Add Trader Receipt ----", receipt);

    // Extract TraderAdded event from transaction receipt
    const traderAddedEvent = receipt.logs.find((log: any) => {
      try {
        const parsedLog = contract.interface.parseLog(log);
        return parsedLog?.name === "TraderAdded";
      } catch {
        return false;
      }
    });

    if (traderAddedEvent) {
      const parsedEvent = contract.interface.parseLog(traderAddedEvent);
      const trader = parsedEvent?.args.trader;
      const addedBy = parsedEvent?.args.addedBy;
      const timestamp = parsedEvent?.args.timestamp;

      console.log("---- Trader Added Event ----");
      console.log("Trader:", trader);
      console.log("Added By:", addedBy);
      console.log("Timestamp:", timestamp?.toString());

      return {
        success: true,
        data: {
          trader: trader as string,
          addedBy: addedBy as string,
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
