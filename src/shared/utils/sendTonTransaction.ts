import { internal, toNano, Address, SendMode } from "@ton/core";
import { getTonClient } from "./getTonBalances";
import { getTonWalletFromEncryptedKey } from "./createTonWallet";

export interface SendTonTransactionParams {
  user: any;
  recipientAddress: string;
  amount: number | string;
  currency?: "TON" | "USDT";
  memo?: string;
  isTestnet?: boolean;
}

export interface SendTonTransactionResult {
  success: boolean;
  signature?: string;
  txHash?: string;
  explorerUrl?: string;
  error?: string;
}

/**
 * Execute native TON payment transaction
 */
export async function sendTonTransaction({
  user,
  recipientAddress,
  amount,
  currency = "TON",
  memo,
  isTestnet = false,
}: SendTonTransactionParams): Promise<SendTonTransactionResult> {
  try {
    if (!user || !user.tonWallets || user.tonWallets.length === 0) {
      throw new Error("User has no TON wallet");
    }

    const defaultWallet = user.tonWallets[0];
    if (!defaultWallet || !defaultWallet.encryptedPrivateKey) {
      throw new Error("Default TON wallet key is missing");
    }

    // 1. Reconstruct wallet contract & keypair from encrypted key
    const version = defaultWallet.version || "v4r2";
    const { keyPair, walletContract } = getTonWalletFromEncryptedKey(
      defaultWallet.encryptedPrivateKey,
      version
    );

    // 2. Setup TonClient
    const client = getTonClient(isTestnet);
    const openedContract = client.open(walletContract);

    // 3. Get current seqno (sequence number)
    let seqno = 0;
    try {
      seqno = await openedContract.getSeqno();
    } catch (e) {
      // Seqno is 0 for undeployed/uninitialized wallet contract
      seqno = 0;
    }

    const destAddress = Address.parse(recipientAddress);

    if (currency === "TON") {
      const valueNano = toNano(amount.toString());

      // 4. Send transfer
      await openedContract.sendTransfer({
        seqno,
        secretKey: keyPair.secretKey,
        sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
        messages: [
          internal({
            to: destAddress,
            value: valueNano,
            body: memo || undefined,
            bounce: false, // Don't bounce even if recipient contract is uninitialized
          }),
        ],
      });

      const explorerDomain = isTestnet ? "testnet.tonscan.org" : "tonscan.org";
      const sourceAddressStr = walletContract.address.toString({ bounceable: false, urlSafe: true });
      const explorerUrl = `https://${explorerDomain}/address/${sourceAddressStr}`;

      console.log(`[TON TX SENT] From: ${sourceAddressStr} To: ${recipientAddress} Amount: ${amount} TON`);

      return {
        success: true,
        signature: `ton-${Date.now()}`,
        txHash: `ton-${Date.now()}`,
        explorerUrl,
      };
    } else {
      throw new Error(`Jetton transfers for ${currency} will be enabled in next update.`);
    }
  } catch (error: any) {
    console.error("TON transaction execution failed:", error);
    return {
      success: false,
      error: error?.message || "Failed to execute TON transaction",
    };
  }
}

export default sendTonTransaction;
