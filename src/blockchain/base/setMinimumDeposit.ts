//Set minimum deposit in the JumpaGroup contract
import { Contract, ethers, Wallet } from "ethers";
import { jumpaGroupAbi } from "./JumpaGroupAbi";
import { config } from "@core/config/config";
import getUser from "@modules/users/getUserInfo";
import { Context } from "telegraf";
import { decryptPrivateKey } from "@shared/utils/encryption";

const provider = new ethers.JsonRpcProvider(config.evmRpcUrl);

/** Set the minimum deposit amount
 * Requires the group address, new minimum deposit, and user context
 * Calls the setMinimumDeposit function and returns the MinimumDepositUpdated event data
 */

export const setMinimumDeposit = async (
  ctx: Context,
  address: string,
  newMinimum: string
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
    // Call setMinimumDeposit function
    const setMinimumTx = await contractWithSigner.setMinimumDeposit(newMinimum);
    console.log("---- Set Minimum Deposit Transaction ----", setMinimumTx);

    // Wait for transaction to be mined
    const receipt = await setMinimumTx.wait();
    console.log("---- Set Minimum Deposit Receipt ----", receipt);

    // Extract MinimumDepositUpdated event from transaction receipt
    const minimumDepositUpdatedEvent = receipt.logs.find((log: any) => {
      try {
        const parsedLog = contract.interface.parseLog(log);
        return parsedLog?.name === "MinimumDepositUpdated";
      } catch {
        return false;
      }
    });

    if (minimumDepositUpdatedEvent) {
      const parsedEvent = contract.interface.parseLog(minimumDepositUpdatedEvent);
      const oldMinimum = parsedEvent?.args.oldMinimum;
      const newMinimumResult = parsedEvent?.args.newMinimum;
      const updatedBy = parsedEvent?.args.updatedBy;
      const timestamp = parsedEvent?.args.timestamp;

      console.log("---- Minimum Deposit Updated Event ----");
      console.log("Old Minimum:", oldMinimum?.toString());
      console.log("New Minimum:", newMinimumResult?.toString());
      console.log("Updated By:", updatedBy);
      console.log("Timestamp:", timestamp?.toString());

      return {
        success: true,
        data: {
          oldMinimum: oldMinimum?.toString(),
          newMinimum: newMinimumResult?.toString(),
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
