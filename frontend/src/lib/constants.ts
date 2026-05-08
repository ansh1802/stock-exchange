export const COMPANIES = [
  { name: 'Vodafone', color: 'bg-company-vodafone', text: 'text-red-400' },
  { name: 'YesBank', color: 'bg-company-yesbank', text: 'text-blue-400' },
  { name: 'Cred', color: 'bg-company-cred', text: 'text-purple-400' },
  { name: 'TCS', color: 'bg-company-tcs', text: 'text-cyan-400' },
  { name: 'Reliance', color: 'bg-company-reliance', text: 'text-orange-400' },
  { name: 'Infosys', color: 'bg-company-infosys', text: 'text-green-400' },
] as const

export const COMPANY_COLOR: Record<string, string> = {
  Vodafone: 'bg-company-vodafone',
  YesBank: 'bg-company-yesbank',
  Cred: 'bg-company-cred',
  TCS: 'bg-company-tcs',
  Reliance: 'bg-company-reliance',
  Infosys: 'bg-company-infosys',
}

export const COMPANY_TEXT_COLOR: Record<string, string> = {
  Vodafone: 'text-red-400',
  YesBank: 'text-blue-400',
  Cred: 'text-purple-400',
  TCS: 'text-cyan-400',
  Reliance: 'text-orange-400',
  Infosys: 'text-green-400',
}

/** 1-based company_num for the backend API */
export const COMPANY_NUM: Record<string, number> = {
  Vodafone: 1,
  YesBank: 2,
  Cred: 3,
  TCS: 4,
  Reliance: 5,
  Infosys: 6,
}

/**
 * 4-char uppercase ticker, mirrored from backend `Company.ticker`. Use this
 * fallback when only a company name string is available (card reveal overlays,
 * ghost animations) and we don't have the full Company object from gameState.
 */
export const COMPANY_TICKER: Record<string, string> = {
  Vodafone: 'VODA',
  YesBank: 'YESB',
  Cred: 'CRED',
  TCS: 'TCS',
  Reliance: 'RELI',
  Infosys: 'INFO',
}

/**
 * Game constants — mirrored from backend/engine/constants.py.
 * Used for rulebook content and tutorial tooltips so numbers in the UI
 * stay in sync with backend rules from a single source.
 */
export const GAME_CONSTANTS = {
  STARTING_CASH: 600,
  STARTING_SHARES: 200,
  CARDS_PER_HAND: 10,
  MAX_DAYS: 10,
  ROUNDS_PER_DAY: 3,
  RIGHTS_ISSUE_VALUE: 10,
  LOAN_STOCK_AMOUNT: 100,
  CURRENCY_RATE: 0.1,
  CHAIRMAN_THRESHOLD: 100,
  DIRECTOR_THRESHOLD: 50,
} as const

export const COMPANY_BASE_VALUES: Record<string, number> = {
  Vodafone: 20,
  YesBank: 25,
  Cred: 40,
  TCS: 55,
  Reliance: 75,
  Infosys: 80,
}
