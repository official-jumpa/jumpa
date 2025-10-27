import User from "../models/user";
import createNewSolanaWallet from "../utils/createWallet";
import getBalance from "../utils/getBalance";

// Cache configuration
const BALANCE_CACHE_DURATION = 3 * 60 * 1000; //3 minutes

async function getUser(telegram_id: Number, username: string) {
  let user = await User.findOne({ telegram_id });

  if (user) {
    // Create wallet if missing
    if (!user.wallet_address) {
      const newWallet = await createNewSolanaWallet(telegram_id);
      user.wallet_address = newWallet.address;
      user.private_key = newWallet.private_key_encrypted;
      await user.save();
    }
    // Update balance if cache is stale
    await updateUserBalance(telegram_id, false);

    return user;
  }

  // Create new user
  const newWallet = await createNewSolanaWallet(telegram_id);

  const newUser = new User({
    telegram_id: telegram_id,
    username: username,
    wallet_address: newWallet.address,
    private_key: newWallet.private_key_encrypted,
    user_balance: 0, // Default to 0, fetch balance when needed
    last_updated_balance: new Date(0), // Set to epoch to force first update
  });

  await newUser.save();
  console.log(`New user created: ${newUser.wallet_address}`);
  return newUser;
}

// Separate function for balance updates. Only call this when user requests for his balance or before making any transaction.
export async function updateUserBalance(telegram_id: Number, forceUpdate = false) {
  console.log("updateUserBalance triggered");
  const user = await User.findOne({ telegram_id });
  if (!user || !user.wallet_address) {
    throw new Error("User not found or no wallet address");
  }

  // Check if balance is still fresh (within cache duration)
  const now = new Date().getTime();
  const lastUpdated = user.last_updated_balance?.getTime() || 0;
  const cacheAge = now - lastUpdated;

  if (!forceUpdate && cacheAge < BALANCE_CACHE_DURATION) {
    console.log(`Using cached balance for ${user.wallet_address} (age: ${Math.round(cacheAge / 1000)}s)`);
    return user.user_balance;
  }

  // Fetch fresh balance
  try {
    const currentBalance = await getBalance(user.wallet_address);
    user.user_balance = currentBalance;
    user.last_updated_balance = new Date();
    await user.save();
    console.log(`Balance updated: ${currentBalance} SOL for ${user.wallet_address}`);
    return currentBalance;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`Failed to update balance: ${errorMessage}`);
    // Return cached balance even if stale
    return user.user_balance;
  }
}
//THE getUserInfo and the getBalcnce files can be combined together later for optimization

export default getUser;
