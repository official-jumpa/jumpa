import * as StellarSdk from "@stellar/stellar-sdk";
import { decryptPrivateKey } from "./encryption";
import { getExplorerUrl, handleBlockchainError } from "@src/blockchain/detector";
import { BlockchainType } from "@src/blockchain/types";
import { ensureStellarTrustline } from "./ensureStellarTrustline";

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
const MAINNET_USDC_ISSUER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const TESTNET_USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

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

    // 4. Construct Operation
    let asset: StellarSdk.Asset;
    let operation: StellarSdk.xdr.Operation;

    if (currency === "XLM") {
      asset = StellarSdk.Asset.native();
      let recipientExists = true;
      try {
        await server.loadAccount(recipientAddress);
      } catch (err: any) {
        if (err?.status === 404 || err?.response?.status === 404) {
          recipientExists = false;
        }
      }

      if (!recipientExists) {
        if (Number(amount) < 1) {
          throw new Error(
            "Destination address is new and inactive. The initial transfer to activate a new Stellar account must be at least 1 XLM."
          );
        }
        operation = StellarSdk.Operation.createAccount({
          destination: recipientAddress,
          startingBalance: amount.toString(),
        });
      } else {
        operation = StellarSdk.Operation.payment({
          destination: recipientAddress,
          asset,
          amount: amount.toString(),
        });
      }
    } else if (currency === "USDC") {
      await ensureStellarTrustline(user, isTestnet);
      const issuer = isTestnet ? TESTNET_USDC_ISSUER : MAINNET_USDC_ISSUER;
      asset = new StellarSdk.Asset("USDC", issuer);

      // Verify recipient exists and has USDC trustline
      try {
        const recipientAccount = await server.loadAccount(recipientAddress);
        const recipientHasTrustline = recipientAccount.balances.some(
          (b: any) => b.asset_code === "USDC" && b.asset_issuer === issuer
        );
        if (!recipientHasTrustline) {
          throw new Error(
            "Recipient address has not enabled a USDC trustline on Stellar yet. The recipient must activate their wallet with XLM and open a USDC trustline."
          );
        }
      } catch (err: any) {
        if (err?.status === 404 || err?.response?.status === 404) {
          throw new Error(
            "Recipient address is not active on the Stellar network. The recipient needs at least 1 XLM to activate their account."
          );
        }
        throw err;
      }

      operation = StellarSdk.Operation.payment({
        destination: recipientAddress,
        asset,
        amount: amount.toString(),
      });
    } else {
      throw new Error(`Unsupported Stellar asset: ${currency}`);
    }

    // 5. Build Transaction
    const txBuilder = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase,
    }).addOperation(operation);

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
