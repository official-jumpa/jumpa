//Get pending members from the JumpaGroup contract
import { Contract, ethers } from "ethers";
import { jumpaGroupAbi } from "./JumpaGroupAbi";
import { config } from "@core/config/config";

const provider = new ethers.JsonRpcProvider(config.evmRpcUrl);

/** Get pending members
 * Retrieves array of members who are pending approval
 * Returns list of addresses waiting for approval
 */

export const getPendingMembers = async (address: string) => {
  const contract = new Contract(address, jumpaGroupAbi.abi, provider);

  try {
    const pendingMembers = await contract.getPendingMembers();
    console.log("---- Pending Members ----", pendingMembers);

    return {
      success: true,
      data: {
        pendingMembers: Array.from(pendingMembers) as string[],
        count: pendingMembers.length,
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
