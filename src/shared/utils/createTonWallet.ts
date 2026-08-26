import { mnemonicNew, mnemonicToWalletKey, keyPairFromSecretKey, keyPairFromSeed } from "@ton/crypto";
import { WalletContractV4, WalletContractV5R1 } from "@ton/ton";
import { Address } from "@ton/core";
import { encryptPrivateKey, decryptPrivateKey } from "./encryption";

export interface TonWalletResult {
  telegram_id: string;
  address: string; // Non-bounceable UQ... format (safe for user deposits)
  bounceableAddress: string; // EQ... format
  rawAddress: string; // 0:... format
  mnemonic?: string; // 24-word recovery phrase (if newly generated or imported as mnemonic)
  private_key: string; // Hex formatted secret key
  private_key_encrypted: string;
  mnemonic_encrypted?: string;
  version: "v4r2" | "v5r1";
}

/**
 * Instantiate the TON wallet contract based on public key and version
 */
export function getWalletContract(publicKey: Buffer, version: "v4r2" | "v5r1" = "v4r2") {
  if (version === "v5r1") {
    return WalletContractV5R1.create({
      workchain: 0,
      publicKey,
    });
  }
  return WalletContractV4.create({
    workchain: 0,
    publicKey,
  });
}

/**
 * Create a new TON wallet with a fresh 24-word mnemonic
 */
export default async function createNewTonWallet(
  telegramId: number,
  version: "v4r2" | "v5r1" = "v4r2"
): Promise<TonWalletResult> {
  try {
    if (!telegramId) {
      throw new Error("Valid telegram_id is required");
    }

    const mnemonicWords = await mnemonicNew(24);
    const keyPair = await mnemonicToWalletKey(mnemonicWords);

    const walletContract = getWalletContract(keyPair.publicKey, version);
    const nonBounceableAddress = walletContract.address.toString({
      bounceable: false,
      urlSafe: true,
    });
    const bounceableAddress = walletContract.address.toString({
      bounceable: true,
      urlSafe: true,
    });
    const rawAddress = walletContract.address.toRawString();

    const secretKeyHex = Buffer.from(keyPair.secretKey).toString("hex");
    const encryptedPrivateKey = encryptPrivateKey(secretKeyHex);

    const mnemonicStr = mnemonicWords.join(" ");
    const mnemonicHex = Buffer.from(mnemonicStr, "utf-8").toString("hex");
    const encryptedMnemonic = encryptPrivateKey(mnemonicHex);

    const newWallet: TonWalletResult = {
      telegram_id: telegramId.toString(),
      address: nonBounceableAddress,
      bounceableAddress,
      rawAddress,
      mnemonic: mnemonicStr,
      private_key: secretKeyHex,
      private_key_encrypted: encryptedPrivateKey,
      mnemonic_encrypted: encryptedMnemonic,
      version,
    };

    console.log(
      `New TON wallet (${version}) created for Telegram ID ${telegramId}:`,
      newWallet.address
    );

    return newWallet;
  } catch (error) {
    console.error(`Failed to create TON wallet for Telegram ID ${telegramId}:`, error);
    throw new Error("TON wallet creation failed");
  }
}

/**
 * Derive TON wallet from a 24-word mnemonic phrase
 */
export async function deriveTonWalletFromMnemonic(
  mnemonicInput: string | string[],
  version: "v4r2" | "v5r1" = "v4r2"
) {
  const words = Array.isArray(mnemonicInput)
    ? mnemonicInput
    : mnemonicInput.trim().split(/\s+/);

  const keyPair = await mnemonicToWalletKey(words);
  const walletContract = getWalletContract(keyPair.publicKey, version);

  const nonBounceableAddress = walletContract.address.toString({
    bounceable: false,
    urlSafe: true,
  });
  const bounceableAddress = walletContract.address.toString({
    bounceable: true,
    urlSafe: true,
  });
  const rawAddress = walletContract.address.toRawString();

  const secretKeyHex = Buffer.from(keyPair.secretKey).toString("hex");
  const encryptedPrivateKey = encryptPrivateKey(secretKeyHex);

  const mnemonicStr = words.join(" ");
  const mnemonicHex = Buffer.from(mnemonicStr, "utf-8").toString("hex");
  const encryptedMnemonic = encryptPrivateKey(mnemonicHex);

  return {
    address: nonBounceableAddress,
    bounceableAddress,
    rawAddress,
    mnemonic: mnemonicStr,
    privateKeyHex: secretKeyHex,
    encryptedPrivateKey,
    encryptedMnemonic,
    keyPair,
    walletContract,
    version,
  };
}

/**
 * Derive TON wallet from raw private key (seed or 64-byte secret key)
 */
export function deriveTonWalletFromPrivateKey(
  privateKeyInput: string,
  version: "v4r2" | "v5r1" = "v4r2"
) {
  const cleanInput = privateKeyInput.trim().replace(/^0x/, "");
  const rawBuffer = Buffer.from(cleanInput, "hex");

  let keyPair: { publicKey: Buffer; secretKey: Buffer };
  if (rawBuffer.length === 32) {
    keyPair = keyPairFromSeed(rawBuffer);
  } else if (rawBuffer.length === 64) {
    keyPair = keyPairFromSecretKey(rawBuffer);
  } else {
    throw new Error(`Invalid private key length: ${rawBuffer.length} bytes (expected 32 or 64 bytes)`);
  }

  const walletContract = getWalletContract(keyPair.publicKey, version);
  const nonBounceableAddress = walletContract.address.toString({
    bounceable: false,
    urlSafe: true,
  });
  const bounceableAddress = walletContract.address.toString({
    bounceable: true,
    urlSafe: true,
  });
  const rawAddress = walletContract.address.toRawString();

  const secretKeyHex = Buffer.from(keyPair.secretKey).toString("hex");
  const encryptedPrivateKey = encryptPrivateKey(secretKeyHex);

  return {
    address: nonBounceableAddress,
    bounceableAddress,
    rawAddress,
    privateKeyHex: secretKeyHex,
    encryptedPrivateKey,
    keyPair,
    walletContract,
    version,
  };
}

/**
 * Reconstruct keypair and wallet contract from encrypted private key in database
 */
export function getTonWalletFromEncryptedKey(
  encryptedPrivateKey: string,
  version: "v4r2" | "v5r1" = "v4r2"
) {
  const decryptedHex = decryptPrivateKey(encryptedPrivateKey);
  const rawBuffer = Buffer.from(decryptedHex, "hex");

  let keyPair: { publicKey: Buffer; secretKey: Buffer };
  if (rawBuffer.length === 32) {
    keyPair = keyPairFromSeed(rawBuffer);
  } else {
    keyPair = keyPairFromSecretKey(rawBuffer);
  }

  const walletContract = getWalletContract(keyPair.publicKey, version);
  return {
    keyPair,
    walletContract,
    address: walletContract.address,
    nonBounceableAddress: walletContract.address.toString({ bounceable: false, urlSafe: true }),
  };
}
