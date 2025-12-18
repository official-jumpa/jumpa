//Transfer ownership of the JumpaGroup contract
import { Contract, ethers, Wallet } from "ethers";
import { jumpaGroupAbi } from "./JumpaGroupAbi";
import { config } from "@core/config/environment";
import getUser from "@features/users/getUserInfo";
import { Context } from "telegraf";
import { decryptPrivateKey } from "@shared/utils/encryption";

const provider = new ethers.JsonRpcProvider(config.evmRpcUrl);

/** Transfer group ownership to a new owner
 * Requires the group address, new owner address, and user context
 * Calls the transferOwnership function and returns the OwnershipTransferred event data
 */

export const transferOwnership = async (
  ctx: Context,
  address: string,
  newOwnerAddress: string
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
    // Call transferOwnership function
    const transferTx = await contractWithSigner.transferOwnership(newOwnerAddress);
    console.log("---- Transfer Ownership Transaction ----", transferTx);

    // Wait for transaction to be mined
    const receipt = await transferTx.wait();
    console.log("---- Transfer Ownership Receipt ----", receipt);

    // Extract OwnershipTransferred event from transaction receipt
    const ownershipTransferredEvent = receipt.logs.find((log: any) => {
      try {
        const parsedLog = contract.interface.parseLog(log);
        return parsedLog?.name === "OwnershipTransferred";
      } catch {
        return false;
      }
    });

    if (ownershipTransferredEvent) {
      const parsedEvent = contract.interface.parseLog(ownershipTransferredEvent);
      const previousOwner = parsedEvent?.args.previousOwner;
      const newOwner = parsedEvent?.args.newOwner;
      const timestamp = parsedEvent?.args.timestamp;

      console.log("---- Ownership Transferred Event ----");
      console.log("Previous Owner:", previousOwner);
      console.log("New Owner:", newOwner);
      console.log("Timestamp:", timestamp?.toString());

      return {
        success: true,
        data: {
          previousOwner: previousOwner as string,
          newOwner: newOwner as string,
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
