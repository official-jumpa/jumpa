/**
 * Combined Application State Management
 * Unifies AI withdrawal, bank update, deposit, order, token carousel, trade, user action, and withdrawal states.
 */

export type SupportedChain = 'SOLANA' | 'BASE' | 'CELO' | 'STELLAR' | 'TON';
export type SupportedCurrency = 'SOL' | 'USDC' | 'USDT' | 'ETH' | 'CELO' | 'XLM' | 'TON';

// ==========================================
// 1. AI Withdrawal State
// ==========================================
export interface AIWithdrawalState {
  step: 'processing' | 'awaiting_bank_name' | 'awaiting_chain' | 'awaiting_currency' | 'awaiting_pin' | 'awaiting_bulk_pin';
  lastUpdated: number;
  data: {
    history?: { role: "user" | "assistant"; content: string }[];
    amount?: number;
    recipient?: string;
    recipients?: any[];
    bankName?: string;
    bankCode?: string;
    accountName?: string;
    chain?: SupportedChain;
    currency?: SupportedCurrency;
    cryptoAmount?: number;
    yaraWalletAddress?: string;
    pinAttempts?: number;
  };
}

const aiWithdrawalStates = new Map<number, AIWithdrawalState>();
const AI_STATE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export function setAIWithdrawalState(
  userId: number,
  step: AIWithdrawalState['step'],
  data: AIWithdrawalState['data']
): void {
  aiWithdrawalStates.set(userId, {
    step,
    data,
    lastUpdated: Date.now()
  });
  console.log(`[AI Withdrawal State] Set state for user ${userId}:`, { step, data });
}

export function getAIWithdrawalState(userId: number): AIWithdrawalState | undefined {
  const state = aiWithdrawalStates.get(userId);
  if (state) {
    const isExpired = Date.now() - state.lastUpdated > AI_STATE_TTL_MS;
    if (isExpired) {
      console.log(`[AI Withdrawal State] State expired for user ${userId}. Clearing.`);
      clearAIWithdrawalState(userId);
      return undefined;
    }
  }
  return state;
}

export function clearAIWithdrawalState(userId: number): void {
  aiWithdrawalStates.delete(userId);
  console.log(`[AI Withdrawal State] Cleared state for user ${userId}`);
}

export function updateAIWithdrawalState(
  userId: number,
  updates: Partial<AIWithdrawalState['data']>
): void {
  const currentState = aiWithdrawalStates.get(userId);
  if (currentState) {
    currentState.data = { ...currentState.data, ...updates };
    currentState.lastUpdated = Date.now();
    aiWithdrawalStates.set(userId, currentState);
    console.log(`[AI Withdrawal State] Updated state for user ${userId}:`, updates);
  }
}

// ==========================================
// 2. Bank Update State
// ==========================================
export interface BankUpdateState {
  step: 'awaiting_bank_name' | 'awaiting_account_name' | 'awaiting_account_number' | 'awaiting_final_confirmation' | 'awaiting_withdrawal_pin' | 'awaiting_withdrawal_pin_confirmation';
  data: {
    bankName?: string;
    bankCode?: string;
    accountName?: string;
    accountNumber?: string;
    withdrawalPin?: number;
  };
}

const bankUpdateState = new Map<number, BankUpdateState>();

export function setBankUpdateState(userId: number, step: BankUpdateState['step'], data: BankUpdateState['data'] = {}) {
  const existingState = bankUpdateState.get(userId);
  const existingData = existingState ? existingState.data : {};
  bankUpdateState.set(userId, { step, data: { ...existingData, ...data } });
}

export function getBankUpdateState(userId: number): BankUpdateState | undefined {
  return bankUpdateState.get(userId);
}

export function clearBankUpdateState(userId: number) {
  bankUpdateState.delete(userId);
}

// ==========================================
// 3. Deposit State
// ==========================================
export interface DepositState {
  step: 'awaiting_amount';
  data: {
    asset?: 'base:usdc' | 'solana:usdc' | 'solana:usdt';
    amount?: number;
  };
}

const depositState = new Map<number, DepositState>();

export function setDepositState(
  userId: number,
  step: DepositState['step'],
  data: DepositState['data'] = {}
) {
  depositState.set(userId, { step, data });
}

export function getDepositState(userId: number): DepositState | undefined {
  return depositState.get(userId);
}

export function clearDepositState(userId: number) {
  depositState.delete(userId);
}

// ==========================================
// 4. Order State
// ==========================================
export interface OrderState {
  transactionBase64: string;
  requestId: string;
  tokenAddress: string;
  symbol: string;
  decimals: number;
  amountNative: number;
  amountUsd: number;
  slippageBps: number;
  feeNative: number;
  tokenAmount: number;
}

const orderState = new Map<number, OrderState>();

export function setOrderState(userId: number, state: OrderState): void {
  orderState.set(userId, state);
}

export function getOrderState(userId: number): OrderState | undefined {
  return orderState.get(userId);
}

export function clearOrderState(userId: number): void {
  orderState.delete(userId);
}

// ==========================================
// 5. Token Carousel State
// ==========================================
export interface TokenCarouselState {
  currentIndex: number;
  tokenAddresses: string[];
}

const carouselState = new Map<number, TokenCarouselState>();
const CAROUSEL_STATE_TTL = 30 * 60 * 1000; // 30 minutes

export function setCarouselState(userId: number, state: TokenCarouselState) {
  carouselState.set(userId, state);
  setTimeout(() => {
    carouselState.delete(userId);
  }, CAROUSEL_STATE_TTL);
}

export function getCarouselState(userId: number): TokenCarouselState | undefined {
  return carouselState.get(userId);
}

export function clearCarouselState(userId: number) {
  carouselState.delete(userId);
}

export function navigateCarousel(userId: number, direction: 'next' | 'prev'): number {
  const state = carouselState.get(userId);
  if (!state) return 0;

  let newIndex = state.currentIndex;
  if (direction === 'next') {
    newIndex = Math.min(state.currentIndex + 1, state.tokenAddresses.length - 1);
  } else {
    newIndex = Math.max(state.currentIndex - 1, 0);
  }

  state.currentIndex = newIndex;
  carouselState.set(userId, state);

  return newIndex;
}

// ==========================================
// 6. Trade State
// ==========================================
export interface TradeStateData {
  contractAddress: string;
  symbol: string;
  decimals: number;
}

const tradeState = new Map<string, TradeStateData>();
const TRADE_STATE_TTL = 15 * 60 * 1000; // 15 minutes

export function setTradeState(id: string, data: TradeStateData) {
  tradeState.set(id, data);
  setTimeout(() => {
    tradeState.delete(id);
  }, TRADE_STATE_TTL);
}

export function getTradeState(id: string): TradeStateData | undefined {
  return tradeState.get(id);
}

export function clearTradeState(id: string) {
  tradeState.delete(id);
}

// ==========================================
// 7. User Action State
// ==========================================
export interface UserActionState {
  action: 'awaiting_custom_buy_amount' | 'awaiting_export_pin' | 'awaiting_import_private_key' | 'awaiting_add_solana_private_key' | 'awaiting_add_evm_private_key' | 'awaiting_add_stellar_private_key' | 'awaiting_add_ton_private_key';
  tradeId?: string;
  walletType?: 'sol' | 'evm' | 'stellar' | 'ton';
  walletIndex?: number;
}

const userActionState = new Map<number, UserActionState>();

export function setUserActionState(userId: number, state: UserActionState) {
  userActionState.set(userId, state);
}

export function getUserActionState(userId: number): UserActionState | undefined {
  return userActionState.get(userId);
}

export function clearUserActionState(userId: number) {
  userActionState.delete(userId);
}

// ==========================================
// 8. Withdrawal State
// ==========================================
export interface WithdrawalState {
  step: 'awaiting_pin' | 'awaiting_custom_amount' | 'awaiting_dest_address' | 'awaiting_onchain_amount' | 'awaiting_onchain_pin';
  data: {
    amount?: string;
    currency?: SupportedCurrency;
    chain?: SupportedChain;
    destination_address?: string;
  };
}

const withdrawalState = new Map<number, WithdrawalState>();

export function setWithdrawalState(userId: number, step: WithdrawalState['step'], data: WithdrawalState['data'] = {}) {
  withdrawalState.set(userId, { step, data });
}

export function getWithdrawalState(userId: number): WithdrawalState | undefined {
  return withdrawalState.get(userId);
}

export function clearWithdrawalState(userId: number) {
  withdrawalState.delete(userId);
}
