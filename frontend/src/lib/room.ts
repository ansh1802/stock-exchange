/** localStorage key for the last name a player entered (prefills the next join). */
export const LAST_NAME_KEY = 'stock-exchange-last-name'

/** A fresh 4-character room code (A–Z, 0–9). */
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let generated = ''
  for (let i = 0; i < 4; i++) generated += chars[Math.floor(Math.random() * chars.length)]
  return generated
}
