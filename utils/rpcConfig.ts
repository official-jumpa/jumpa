import { Connection, clusterApiUrl } from "@solana/web3.js";
import { config } from "../config/config";

let connection: Connection | null = null;
const api_url = config.rpcUrl;

export const getSolanaConnection = (): Connection => {
  if (!connection) {
    connection = new Connection(api_url, {
      commitment: "confirmed",
      confirmTransactionInitialTimeout: 60000,
    });
  }
  return connection;
};
