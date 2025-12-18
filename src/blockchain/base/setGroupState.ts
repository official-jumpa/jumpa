//Set group state in the JumpaGroup contract
import { Contract, ethers, Wallet } from "ethers";
import { jumpaGroupAbi } from "./JumpaGroupAbi";
import { config } from "@core/config/config";
import getUser from "@modules/users/getUserInfo";
import { Context } from "telegraf";
import { decryptPrivateKey } from "@shared/utils/encryption";

const provider = new ethers.JsonRpcProvider(config.evmRpcUrl);

/** Set the group state
 * Requires the group address, new state, and user context
 * Calls the setGroupState function and returns the GroupStateChanged event data
 * States: 0 = Open, 1 = Trading, 2 = Closed, 3 = Paused
 */

export const setGroupState = async (
  ctx: Context,
  address: string,
  newState: number
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
    // Call setGroupState function
    const setStateTx = await contractWithSigner.setGroupState(newState);
    console.log("---- Set Group State Transaction ----", setStateTx);

    // Wait for transaction to be mined
    const receipt = await setStateTx.wait();
    console.log("---- Set Group State Receipt ----", receipt);

    // Extract GroupStateChanged event from transaction receipt
    const groupStateChangedEvent = receipt.logs.find((log: any) => {
      try {
        const parsedLog = contract.interface.parseLog(log);
        return parsedLog?.name === "GroupStateChanged";
      } catch {
        return false;
      }
    });

    if (groupStateChangedEvent) {
      const parsedEvent = contract.interface.parseLog(groupStateChangedEvent);
      const oldState = parsedEvent?.args.oldState;
      const newStateResult = parsedEvent?.args.newState;
      const changedBy = parsedEvent?.args.changedBy;
      const timestamp = parsedEvent?.args.timestamp;

      console.log("---- Group State Changed Event ----");
      console.log("Old State:", oldState?.toString());
      console.log("New State:", newStateResult?.toString());
      console.log("Changed By:", changedBy);
      console.log("Timestamp:", timestamp?.toString());

      return {
        success: true,
        data: {
          oldState: oldState?.toString(),
          newState: newStateResult?.toString(),
          changedBy: changedBy as string,
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
