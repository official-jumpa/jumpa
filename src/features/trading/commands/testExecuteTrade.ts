import { PublicKey } from "@solana/web3.js";
import { getJupiterSwapData } from "./GetJupiterSwapData"; 
import { executeTrade } from "@blockchain/solana/executeTrade";

export async function runTrade() {
  console.log("runTrade called...");
  try {
    const inputMint = "So11111111111111111111111111111111111111112"; // SOL
    const outputMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"; // USDC
    const amountIn = 1_000_000; // 0.001 SOL (in lamports)

    // Step 1: Fetch quote
    const quoteResponse = await fetch(
      `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountIn}&slippageBps=50`
    ).then((res) => res.json());

    // Step 2: Get Jupiter swap instruction data
    const jupiterData = await getJupiterSwapData(
      quoteResponse,
      "9Q9ZkZScbGhEyQLAUnr8Fg8Y2xg9rkRwjJK9zVxMmgXz"
    );

    console.log("Jupiter data fetched:", {
      inputMint,
      outputMint,
      minOut: jupiterData.quoteResponse.outAmountWithSlippage,
      remainingAccountsCount: jupiterData.remainingAccounts.length,
    });

    // Step 3: Execute swap on-chain
    await executeTrade({
      telegramId: 12345,
      groupPDA: "9Q9ZkZScbGhEyQLAUnr8Fg8Y2xg9rkRwjJK9zVxMmgXz",
      tokenMintIn: inputMint,
      tokenMintOut: outputMint,
      groupTokenAccountIn: "Fx5pK7w5YQyyNRKJ2M3Eapv2pCz6mFwFsEjHTAv1D2rJ",
      groupTokenAccountOut: "9VmJWrkbfyKMYDkpZbD7LgVhXGgjKRJQxyTgE8PxW4Bo",
      jupiterProgram: jupiterData.programId.toBase58(),
      amountIn,
      minAmountOut: jupiterData.quoteResponse.outAmountWithSlippage,
      instructionData: jupiterData.instructionData,
      remainingAccounts: jupiterData.remainingAccounts,
    });

    console.log("Trade executed successfully!");
  } catch (error) {
    console.error("Error in runTrade:", error);
  }
}
