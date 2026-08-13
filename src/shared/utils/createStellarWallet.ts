import { Keypair as StellarKeypair } from "@stellar/stellar-sdk";
import * as bip39 from "bip39";
import { derivePath } from "ed25519-hd-key";
import { encryptPrivateKey, decryptPrivateKey } from "./encryption";

export interface StellarWalletResult {
  telegram_id: string;
  address: string;
  private_key: string; // S... format secret key
  private_key_encrypted: string;
}

/**
 * Derive Stellar keypair from a BIP39 mnemonic using standard path m/44'/148'/0'
 */
export function deriveStellarKeypairFromMnemonic(mnemonic: string): StellarKeypair {
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const stellarDerived = derivePath("m/44'/148'/0'", seed.toString("hex")).key;
  return StellarKeypair.fromRawEd25519Seed(Buffer.from(stellarDerived));
}

/**
 * Reconstruct StellarKeypair from encrypted private key stored in database
 */
export function getStellarKeypairFromEncryptedKey(encryptedPrivateKey: string): StellarKeypair {
  const decryptedHex = decryptPrivateKey(encryptedPrivateKey);
  return StellarKeypair.fromRawEd25519Seed(Buffer.from(decryptedHex, "hex"));
}

/**
 * Create a new random Stellar wallet for a user
 */
export default async function createNewStellarWallet(
  telegramId: number
): Promise<StellarWalletResult> {
  try {
    if (!telegramId) {
      throw new Error("Valid telegram_id is required");
    }

    const stellarKeypair = StellarKeypair.random();
    const secretKey = stellarKeypair.secret(); // S... format
    const rawSeedHex = Buffer.from(stellarKeypair.rawSecretKey()).toString("hex");
    const encryptedPrivateKey = encryptPrivateKey(rawSeedHex);

    const newWallet: StellarWalletResult = {
      telegram_id: telegramId.toString(),
      address: stellarKeypair.publicKey(),
      private_key: secretKey,
      private_key_encrypted: encryptedPrivateKey,
    };

    console.log(
      `New Stellar wallet created for Telegram ID ${telegramId}:`,
      newWallet.address
    );

    return newWallet;
  } catch (error) {
    console.error(
      `Failed to create Stellar wallet for Telegram ID ${telegramId}:`,
      error
    );
    throw new Error("Stellar wallet creation failed");
  }
}
