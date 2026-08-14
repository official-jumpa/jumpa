import { SwitchBanks } from './SwitchBanks';

export interface SwitchBank {
  code: string;
  name: string;
  icon?: string;
}

export const switchBankCodes: SwitchBank[] = SwitchBanks;

const BANK_ALIASES: Record<string, string> = {
  gtb: 'gtbank plc',
  gtco: 'gtbank plc',
  'guaranty trust bank': 'gtbank plc',
  uba: 'united bank for africa',
  'first bank': 'first bank of nigeria',
  firstbank: 'first bank of nigeria',
  kuda: 'kuda microfinance bank',
  moniepoint: 'moniepoint microfinance bank',
  vfd: 'vfd microfinance bank',
  stanbic: 'stanbic ibtc bank',
  fcmb: 'fcmb microfinance bank',
};

/**
 * Find Switch 6-digit bank code by bank name using fuzzy matching
 * @param bankName - Name of the bank to search for
 * @returns 6-digit bank code string or null if not found
 */
export function findSwitchBankCode(bankName: string): string | null {
  if (!bankName) return null;

  let normalized = bankName.trim().toLowerCase();
  if (BANK_ALIASES[normalized]) {
    normalized = BANK_ALIASES[normalized];
  }

  // 1. Exact match (case insensitive)
  const exactMatch = switchBankCodes.find(
    (bank) => bank.name.toLowerCase() === normalized
  );
  if (exactMatch) return exactMatch.code;

  // 2. Partial match (bank name contains search term)
  const partialMatch = switchBankCodes.find((bank) =>
    bank.name.toLowerCase().includes(normalized)
  );
  if (partialMatch) return partialMatch.code;

  // 3. Reverse match (search term contains bank name)
  const reverseMatch = switchBankCodes.find((bank) =>
    normalized.includes(bank.name.toLowerCase())
  );
  if (reverseMatch) return reverseMatch.code;

  // 4. Token-based matching (common alias handling)
  const tokens = normalized.split(/\s+/);
  const tokenMatch = switchBankCodes.find((bank) => {
    const bankNameLower = bank.name.toLowerCase();
    return tokens.every((token) => bankNameLower.includes(token));
  });
  if (tokenMatch) return tokenMatch.code;

  return null;
}

/**
 * Get full bank details by code
 */
export function getSwitchBankByCode(code: string): SwitchBank | null {
  if (!code) return null;
  const paddedCode = code.padStart(6, '0');
  return switchBankCodes.find((bank) => bank.code === paddedCode || bank.code === code) || null;
}
