import User from "../models/user";
import createNewSolanaWallet from "../utils/createWallet";
import getBalance from "../utils/getBalance";

async function getUser(telegram_id: Number, username: string) {
  // Check if the user already exists
  let user = await User.findOne({ telegram_id });

  if (user) {
    // Always try to update the balance for existing users
    try {
      // If no wallet address exists, create a new wallet
      if (!user.wallet_address) {
        const newWallet = await createNewSolanaWallet(telegram_id);
        user.wallet_address = newWallet.address;
        user.private_key = newWallet.private_key_encrypted;
      }

      // Try to fetch and update the current balance, but don't fail if RPC is down
      try {
        const currentBalance = await getBalance(user.wallet_address);
        // console.log(user.private_key)
        // Update balance and timestamp
        user.user_balance = currentBalance;
        user.last_updated_balance = new Date();
        console.log(`User balance updated: ${currentBalance} SOL`);
      } catch (balanceError) {
        const errorMessage =
          balanceError instanceof Error
            ? balanceError.message
            : String(balanceError);
        console.warn(
          `Failed to update balance for user ${user.wallet_address}: ${errorMessage}`
        );
        // Continue without updating balance - user can still use the bot
      }

      await user.save();
      console.log(`User data saved: ${user.wallet_address}`);

      return user;
    } catch (error) {
      console.error(`Error updating user balance: ${error}`);
      throw error;
    }
  }

  // Create a new user if not exists
  try {
    const newWallet = await createNewSolanaWallet(telegram_id);

    // Try to get balance, but don't fail if RPC is down
    let initialBalance = 0;
    try {
      initialBalance = await getBalance(newWallet.address);
      console.log(`Balance fetched successfully: ${initialBalance} SOL`);
    } catch (balanceError) {
      const errorMessage =
        balanceError instanceof Error
          ? balanceError.message
          : String(balanceError);
      console.warn(`Failed to fetch initial balance, using 0: ${errorMessage}`);
      initialBalance = 0;
    }

    const newUser = new User({
      telegram_id: telegram_id,
      username: username,
      wallet_address: newWallet.address,
      private_key: newWallet.private_key_encrypted,
      user_balance: initialBalance,
      last_updated_balance: new Date(),
    });

    await newUser.save();
    console.log(`New user created successfully: ${newUser.wallet_address}`);
    return newUser;
  } catch (error) {
    console.error(`Error creating new user: ${error}`);
    throw error;
  }
}

export default getUser;
