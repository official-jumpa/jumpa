//Get all group constants from the JumpaGroup contract
import { Contract, ethers } from "ethers";
import { jumpaGroupAbi } from "./JumpaGroupAbi";
import { config } from "@core/config/config";

const provider = new ethers.JsonRpcProvider(config.evmRpcUrl);

/** Get all group constants
 * Retrieves all constant values from the group contract
 * Returns all 6 constants in a single call
 */

export const getGroupConstants = async (address: string) => {
  const contract = new Contract(address, jumpaGroupAbi.abi, provider);

  try {
    // Fetch constants in batches of 3 (free tier limit)
    // First batch: 3 constants
    const [defaultMinimumDeposit, maxBlacklist, maxMembers] = await Promise.all(
      [
        contract.DEFAULT_MINIMUM_DEPOSIT(),
        contract.MAX_BLACKLIST(),
        contract.MAX_MEMBERS(),
      ]
    );

    // Second batch: 3 constants
    const [maxNameLen, maxTraders, minNameLen] = await Promise.all([
      contract.MAX_NAME_LEN(),
      contract.MAX_TRADERS(),
      contract.MIN_NAME_LEN(),
    ]);

    console.log("---- Group Constants ----");
    console.log("Default Minimum Deposit:", defaultMinimumDeposit?.toString());
    console.log("Max Blacklist:", maxBlacklist?.toString());
    console.log("Max Members:", maxMembers?.toString());
    console.log("Max Name Length:", maxNameLen?.toString());
    console.log("Max Traders:", maxTraders?.toString());
    console.log("Min Name Length:", minNameLen?.toString());

    return {
      success: true,
      data: {
        defaultMinimumDeposit: defaultMinimumDeposit?.toString(),
        maxBlacklist: Number(maxBlacklist),
        maxMembers: Number(maxMembers),
        maxNameLen: Number(maxNameLen),
        maxTraders: Number(maxTraders),
        minNameLen: Number(minNameLen),
      },
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

export const getMinimumDeposit = async (address: string) => {
  const contract = new Contract(address, jumpaGroupAbi.abi, provider);

  try {
    // Fetch constants in batches of 3 (free tier limit)
    // First batch: 3 constants
    const defaultMinimumDeposit = await contract.DEFAULT_MINIMUM_DEPOSIT();
    const formattedMinDeposit = ethers.formatEther(defaultMinimumDeposit);
    console.log("formattedMinDeposit", formattedMinDeposit)

    console.log("---- Group Constants ----");
    console.log("Default Minimum Deposit:", defaultMinimumDeposit?.toString());

    return {
      success: true,
      data: {
        defaultMinimumDeposit: defaultMinimumDeposit?.toString(),
        formattedMinDeposit,
      },
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
