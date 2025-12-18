//Distribute profits in the JumpaGroup contract
import { Contract, ethers, Wallet } from "ethers";
import { jumpaGroupAbi } from "./JumpaGroupAbi";
import { config } from "@core/config/environment";
import getUser from "@features/users/getUserInfo";
import { Context } from "telegraf";
import { decryptPrivateKey } from "@shared/utils/encryption";

const provider = new ethers.JsonRpcProvider(config.evmRpcUrl);

/** Distribute profit to group members
 * Requires the group address and user context
 * Calls the distributeProfit function and returns the ProfitDistributed event data
 */

export const distributeProfit = async (ctx: Context, address: string) => {
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
    // Call distributeProfit function
    const distributeTx = await contractWithSigner.distributeProfit();
    console.log("---- Distribute Profit Transaction ----", distributeTx);

    // Wait for transaction to be mined
    const receipt = await distributeTx.wait();
    console.log("---- Distribute Profit Receipt ----", receipt);

    // Extract ProfitDistributed event from transaction receipt
    const profitDistributedEvent = receipt.logs.find((log: any) => {
      try {
        const parsedLog = contract.interface.parseLog(log);
        return parsedLog?.name === "ProfitDistributed";
      } catch {
        return false;
      }
    });

    if (profitDistributedEvent) {
      const parsedEvent = contract.interface.parseLog(profitDistributedEvent);
      const trader = parsedEvent?.args.trader;
      const recipient = parsedEvent?.args.recipient;
      const token = parsedEvent?.args.token;
      const amount = parsedEvent?.args.amount;
      const actualAmount = parsedEvent?.args.actualAmount;
      const timestamp = parsedEvent?.args.timestamp;

      console.log("---- Profit Distributed Event ----");
      console.log("Trader:", trader);
      console.log("Recipient:", recipient);
      console.log("Token:", token);
      console.log("Amount:", amount?.toString());
      console.log("Actual Amount:", actualAmount?.toString());
      console.log("Timestamp:", timestamp?.toString());

      return {
        success: true,
        data: {
          trader: trader as string,
          recipient: recipient as string,
          token: token as string,
          amount: amount?.toString(),
          actualAmount: actualAmount?.toString(),
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
