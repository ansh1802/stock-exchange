import type { Card } from '../types/game'

const COMPANY_ORDER: Record<string, number> = {
  Vodafone: 0,
  YesBank: 1,
  Cred: 2,
  TCS: 3,
  Reliance: 4,
  Infosys: 5,
}

const POWER_ORDER: Record<string, number> = {
  RightsIssue: 0,
  ShareSuspend: 1,
  LoanStock: 2,
  Debenture: 3,
  'Currency + ': 4,
  'Currency - ': 5,
}

/**
 * Stable display order for a player's hand. Company cards first (canonical
 * company order), grouped by company; within a company positives come before
 * negatives, then by descending magnitude. Power cards trail at the end in
 * a fixed order. Pure — does not mutate the input.
 */
export function sortHand(hand: Card[]): Card[] {
  return [...hand].sort((a, b) => {
    if (a.is_power !== b.is_power) return a.is_power ? 1 : -1

    if (!a.is_power) {
      const ca = COMPANY_ORDER[a.company] ?? 99
      const cb = COMPANY_ORDER[b.company] ?? 99
      if (ca !== cb) return ca - cb
      // Positives first, then negatives
      if (a.positive !== b.positive) return a.positive ? -1 : 1
      // Within same sign: bigger magnitude first
      return b.value - a.value
    }

    // Power cards
    const pa = POWER_ORDER[a.company] ?? 99
    const pb = POWER_ORDER[b.company] ?? 99
    return pa - pb
  })
}
