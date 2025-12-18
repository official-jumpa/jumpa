//Execute a token swap in the JumpaGroup contract
import { Contract, ethers, Wallet } from "ethers";
import { jumpaGroupAbi } from "./JumpaGroupAbi";
import { config } from "@core/config/config";
import getUser from "@modules/users/getUserInfo";
import { Context } from "telegraf";
import { decryptPrivateKey } from "@shared/utils/encryption";

const provider = new ethers.JsonRpcProvider(config.evmRpcUrl);

/** Execute a token swap for the group
 * Requires the group address, swap parameters, and user context
 * Calls the executeSwap function and returns the SwapExecuted event data
 */

export interface SwapParams {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  minAmountOut: string;
  swapData: string;
}

export const executeSwap = async (
  ctx: Context,
  address: string,
  swapParams: SwapParams
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
    // Call executeSwap function with swap parameters
    const swapTx = await contractWithSigner.executeSwap(swapParams);
    console.log("---- Execute Swap Transaction ----", swapTx);

    // Wait for transaction to be mined
    const receipt = await swapTx.wait();
    console.log("---- Execute Swap Receipt ----", receipt);

    // Extract SwapExecuted event from transaction receipt
    const swapExecutedEvent = receipt.logs.find((log: any) => {
      try {
        const parsedLog = contract.interface.parseLog(log);
        return parsedLog?.name === "SwapExecuted";
      } catch {
        return false;
      }
    });

    if (swapExecutedEvent) {
      const parsedEvent = contract.interface.parseLog(swapExecutedEvent);
      const trader = parsedEvent?.args.trader;
      const tokenIn = parsedEvent?.args.tokenIn;
      const tokenOut = parsedEvent?.args.tokenOut;
      const amountIn = parsedEvent?.args.amountIn;
      const amountOut = parsedEvent?.args.amountOut;
      const minAmountOut = parsedEvent?.args.minAmountOut;
      const timestamp = parsedEvent?.args.timestamp;

      console.log("---- Swap Executed Event ----");
      console.log("Trader:", trader);
      console.log("Token In:", tokenIn);
      console.log("Token Out:", tokenOut);
      console.log("Amount In:", amountIn?.toString());
      console.log("Amount Out:", amountOut?.toString());
      console.log("Min Amount Out:", minAmountOut?.toString());
      console.log("Timestamp:", timestamp?.toString());

      return {
        success: true,
        data: {
          trader: trader as string,
          tokenIn: tokenIn as string,
          tokenOut: tokenOut as string,
          amountIn: amountIn?.toString(),
          amountOut: amountOut?.toString(),
          minAmountOut: minAmountOut?.toString(),
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
