//read the group data from the JumpaGroup contract
import { Contract, ethers } from "ethers";import { jumpaGroupAbi } from "./JumpaGroupAbi";
import { config } from "@core/config/config";

const provider = new ethers.JsonRpcProvider(config.evmRpcUrl);

export const fetchBaseGroupInfo = async (address: string) => {
  const contractAddress = address; //always interact with the user's created group trading CA
  const contract = new Contract(contractAddress, jumpaGroupAbi.abi, provider);

  try {
    const groupInfo = await contract.getGroupInfo();
    console.log("---- Group Info: ----", groupInfo);

    // Destructure the Result array based on your contract's struct
    const [
      groupAddress, // 0x2256EF50...
      maxSlippagePercentage, // 10n
      maxSwapPercentage, // 25n
      isPrivate, // true
      state, // 0,1,2,3 (0=open, 1=trading, 2 = closed, paused)
      name, // 'lockedIn'
      traders, // Result(1) [address]
      members, // Result(1) [address]
      blacklist, // Result(0) []
      minimumDeposit, // 50000000000000000n
      totalContributions, // 0n
      createdAt, // 1765310076n
    ] = groupInfo;

    return {
      success: true,
      data: {
        groupAddress: groupAddress as string,
        maxSlippagePercentage: Number(maxSlippagePercentage),
        maxSwapPercentage: Number(maxSwapPercentage),
        isPrivate: isPrivate as boolean,
        state: state.toString(),
        name: name as string,
        traders: Array.from(traders) as string[],
        members: Array.from(members) as string[],
        blacklist: Array.from(blacklist) as string[],
        minimumDeposit: minimumDeposit.toString(),
        totalContributions: totalContributions.toString(),
        createdAt: Number(createdAt),
      },
    };
  } catch (error) {
    // console.error("Error fetching group info:", error);
    console.log("short error msg", error.code);
    console.log("detailed error 2", error);
    return {
      success: false,
      data: error.code,
    };
  }
};
