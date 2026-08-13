import * as StellarSdk from "@stellar/stellar-sdk";
import { decryptPrivateKey } from "./encryption";
import { getExplorerUrl, handleBlockchainError } from "@src/blockchain/detector";
import { BlockchainType } from "@src/blockchain/types";

export interface SendStellarTransactionParams {
  user: any;
  recipientAddress: string;
  amount: number | string;
  currency?: "XLM" | "USDC";
  memo?: string;
  isTestnet?: boolean;
}

export interface SendStellarTransactionResult {
  success: boolean;
  signature?: string;
  txHash?: string;
  explorerUrl?: string;
  error?: string;
}

const MAINNET_HORIZON_URL = "https://horizon.stellar.org";
const TESTNET_HORIZON_URL = "https://horizon-testnet.stellar.org";
const MAINNET_USDC_ISSUER = "GBBD7DY23W7RLSTQ27ADK33C34tMs6rrss2vtxf44RpBwMsA543c7B6c";
const TESTNET_USDC_ISSUER = "GBFDCVPTQCACGEGKY65TT47MM2O2CGCWKIZVNZRA62Q7H66E264TNMIK";

/**
 * Execute Stellar (XLM / USDC) payment transaction
 */
export async function sendStellarTransaction({
  user,
  recipientAddress,
  amount,
  currency = "XLM",
  memo,
  isTestnet = false,
}: SendStellarTransactionParams): Promise<SendStellarTransactionResult> {
  try {
    if (!user || !user.stellarWallets || user.stellarWallets.length === 0) {
      throw new Error("User has no Stellar wallet");
    }

    const defaultWallet = user.stellarWallets[0];
    if (!defaultWallet || !defaultWallet.encryptedPrivateKey) {
      throw new Error("Default Stellar wallet key is missing");
    }

    // 1. Decrypt raw Ed25519 seed from database
    const rawSecretHex = decryptPrivateKey(defaultWallet.encryptedPrivateKey);
    const keypair = StellarSdk.Keypair.fromRawEd25519Seed(
      Buffer.from(rawSecretHex, "hex")
    );
    const sourceAddress = keypair.publicKey();

    // 2. Setup Horizon Server and Network Passphrase
    const horizonUrl = isTestnet ? TESTNET_HORIZON_URL : MAINNET_HORIZON_URL;
    const server = new StellarSdk.Horizon.Server(horizonUrl);
    const networkPassphrase = isTestnet
      ? StellarSdk.Networks.TESTNET
      : StellarSdk.Networks.PUBLIC;

    // 3. Load source account state
    const sourceAccount = await server.loadAccount(sourceAddress);

    // 4. Construct Asset
    let asset: StellarSdk.Asset;
    if (currency === "XLM") {
      asset = StellarSdk.Asset.native();
    } else if (currency === "USDC") {
      const issuer = isTestnet ? TESTNET_USDC_ISSUER : MAINNET_USDC_ISSUER;
      asset = new StellarSdk.Asset("USDC", issuer);
    } else {
      throw new Error(`Unsupported Stellar asset: ${currency}`);
    }

    // 5. Build Transaction
    const txBuilder = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase,
    }).addOperation(
      StellarSdk.Operation.payment({
        destination: recipientAddress,
        asset,
        amount: amount.toString(),
      })
    );

    if (memo) {
      txBuilder.addMemo(StellarSdk.Memo.text(memo));
    }

    const transaction = txBuilder.setTimeout(30).build();

    // 6. Sign and Submit
    transaction.sign(keypair);
    const response = await server.submitTransaction(transaction);

    const hash = response.hash;
    const explorerUrl = getExplorerUrl(
      BlockchainType.STELLAR,
      hash,
      isTestnet
    );

    console.log(`[STELLAR TX SUCCESS] Hash: ${hash}`);

    return {
      success: true,
      signature: hash,
      txHash: hash,
      explorerUrl,
    };
  } catch (error: any) {
    console.error("Stellar transaction execution failed:", error);
    const formattedError = handleBlockchainError(
      error,
      BlockchainType.STELLAR
    );
    return {
      success: false,
      error: formattedError,
    };
  }
}

export default sendStellarTransaction;
