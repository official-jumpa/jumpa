import * as StellarSdk from "@stellar/stellar-sdk";
import { decryptPrivateKey } from "./encryption";
import { STELLAR_MAINNET_USDC_ISSUER, STELLAR_TESTNET_USDC_ISSUER } from "./getStellarBalances";

/**
 * Checks if the user's Stellar wallet has a USDC trustline established.
 * If not (and the wallet has sufficient XLM balance), automatically submits a changeTrust operation.
 */
export async function ensureStellarTrustline(
  user: any,
  isTestnet: boolean = false
): Promise<boolean> {
  try {
    if (!user || !user.stellarWallets || user.stellarWallets.length === 0) {
      return false;
    }

    const defaultWallet = user.stellarWallets[0];
    if (!defaultWallet || !defaultWallet.encryptedPrivateKey) {
      return false;
    }

    const rawSecretHex = decryptPrivateKey(defaultWallet.encryptedPrivateKey);
    const keypair = StellarSdk.Keypair.fromRawEd25519Seed(
      Buffer.from(rawSecretHex, "hex")
    );
    const publicKey = keypair.publicKey();

    const horizonUrl = isTestnet
      ? "https://horizon-testnet.stellar.org"
      : "https://horizon.stellar.org";
    const usdcIssuer = isTestnet
      ? STELLAR_TESTNET_USDC_ISSUER
      : STELLAR_MAINNET_USDC_ISSUER;
    const server = new StellarSdk.Horizon.Server(horizonUrl);
    const networkPassphrase = isTestnet
      ? StellarSdk.Networks.TESTNET
      : StellarSdk.Networks.PUBLIC;

    const account = await server.loadAccount(publicKey);

    // Check if USDC trustline already exists
    const hasTrustline = account.balances.some(
      (b: any) => b.asset_code === "USDC" && b.asset_issuer === usdcIssuer
    );

    if (hasTrustline) {
      return true;
    }

    // Check if account has sufficient XLM to open trustline (requires ~1.5 XLM reserve)
    const nativeBal = account.balances.find((b: any) => b.asset_type === "native");
    const xlmBalance = nativeBal ? parseFloat(nativeBal.balance) : 0;
    if (xlmBalance < 1.5) {
      console.log(
        `[Stellar Trustline] Insufficient XLM balance (${xlmBalance}) to create USDC trustline for ${publicKey}.`
      );
      return false;
    }

    console.log(`[Stellar Trustline] Creating USDC trustline for ${publicKey}...`);
    const usdcAsset = new StellarSdk.Asset("USDC", usdcIssuer);
    const tx = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase,
    })
      .addOperation(StellarSdk.Operation.changeTrust({ asset: usdcAsset }))
      .setTimeout(30)
      .build();

    tx.sign(keypair);
    const res = await server.submitTransaction(tx);
    console.log(
      `[Stellar Trustline] USDC Trustline established successfully! Hash: ${res.hash}`
    );
    return true;
  } catch (err: any) {
    console.error(
      "[Stellar Trustline] Error ensuring trustline:",
      err?.message || err
    );
    return false;
  }
}
