import dotenv from "dotenv";

dotenv.config();

export const config = {
  botToken: process.env.BOT_TOKEN,
  dbUrl: process.env.DB_URL,
  rpcUrl: process.env.RPC_URL || "",
};