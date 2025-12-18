//Remove address from blacklist in the JumpaGroup contract
import { Contract, ethers, Wallet } from "ethers";
import { jumpaGroupAbi } from "./JumpaGroupAbi";
import { config } from "@core/config/config";
import getUser from "@modules/users/getUserInfo";
import { Context } from "telegraf";
import { decryptPrivateKey } from "@shared/utils/encryption";

const provider = new ethers.JsonRpcProvider(config.evmRpcUrl);

/** Remove address from blacklist
 * Requires the group address, address to remove, and user context
 * Calls the removeFromBlacklist function and returns the AddressUnblacklisted event data
 */

export const removeFromBlacklist = async (
  ctx: Context,
  address: string,
  addressToRemove: string
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
    // Call removeFromBlacklist function
    const unblacklistTx = await contractWithSigner.removeFromBlacklist(addressToRemove);
    console.log("---- Remove From Blacklist Transaction ----", unblacklistTx);

    // Wait for transaction to be mined
    const receipt = await unblacklistTx.wait();
    console.log("---- Remove From Blacklist Receipt ----", receipt);

    // Extract AddressUnblacklisted event from transaction receipt
    const addressUnblacklistedEvent = receipt.logs.find((log: any) => {
      try {
        const parsedLog = contract.interface.parseLog(log);
        return parsedLog?.name === "AddressUnblacklisted";
      } catch {
        return false;
      }
    });

    if (addressUnblacklistedEvent) {
      const parsedEvent = contract.interface.parseLog(addressUnblacklistedEvent);
      const addr = parsedEvent?.args.addr;
      const unblacklistedBy = parsedEvent?.args.unblacklistedBy;
      const timestamp = parsedEvent?.args.timestamp;

      console.log("---- Address Unblacklisted Event ----");
      console.log("Address:", addr);
      console.log("Unblacklisted By:", unblacklistedBy);
      console.log("Timestamp:", timestamp?.toString());

      return {
        success: true,
        data: {
          address: addr as string,
          unblacklistedBy: unblacklistedBy as string,
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
