//Add address to blacklist in the JumpaGroup contract
import { Contract, ethers, Wallet } from "ethers";
import { jumpaGroupAbi } from "./JumpaGroupAbi";
import { config } from "@core/config/environment";
import getUser from "@features/users/getUserInfo";
import { Context } from "telegraf";
import { decryptPrivateKey } from "@shared/utils/encryption";

const provider = new ethers.JsonRpcProvider(config.evmRpcUrl);

/** Add address to blacklist
 * Requires the group address, address to blacklist, and user context
 * Calls the addToBlacklist function and returns the AddressBlacklisted event data
 */

export const addToBlacklist = async (
  ctx: Context,
  address: string,
  addressToBlacklist: string
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
    // Call addToBlacklist function
    const blacklistTx = await contractWithSigner.addToBlacklist(addressToBlacklist);
    console.log("---- Add To Blacklist Transaction ----", blacklistTx);

    // Wait for transaction to be mined
    const receipt = await blacklistTx.wait();
    console.log("---- Add To Blacklist Receipt ----", receipt);

    // Extract AddressBlacklisted event from transaction receipt
    const addressBlacklistedEvent = receipt.logs.find((log: any) => {
      try {
        const parsedLog = contract.interface.parseLog(log);
        return parsedLog?.name === "AddressBlacklisted";
      } catch {
        return false;
      }
    });

    if (addressBlacklistedEvent) {
      const parsedEvent = contract.interface.parseLog(addressBlacklistedEvent);
      const addr = parsedEvent?.args.addr;
      const blacklistedBy = parsedEvent?.args.blacklistedBy;
      const timestamp = parsedEvent?.args.timestamp;

      console.log("---- Address Blacklisted Event ----");
      console.log("Address:", addr);
      console.log("Blacklisted By:", blacklistedBy);
      console.log("Timestamp:", timestamp?.toString());

      return {
        success: true,
        data: {
          address: addr as string,
          blacklistedBy: blacklistedBy as string,
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
