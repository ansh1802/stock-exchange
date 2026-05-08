/**
 * localStorage-backed tutorial state. No backend, no server-side migration.
 * Cleared state simply restores the "Learn to Play" CTA — that's acceptable.
 */

const KEY_COMPLETED = 'se.tutorial.completed'
const KEY_TOOLTIPS_SEEN = 'se.tutorial.tooltipsSeen'
const KEY_LAST_CHAPTER = 'se.tutorial.lastChapter'
const KEY_TIPS_DISABLED = 'se.tutorial.tipsDisabled'

export const tutorialStorage = {
  isCompleted(): boolean {
    try { return localStorage.getItem(KEY_COMPLETED) === '1' } catch { return false }
  },
  markCompleted() {
    try { localStorage.setItem(KEY_COMPLETED, '1') } catch { /* ignore */ }
  },
  resetCompleted() {
    try { localStorage.removeItem(KEY_COMPLETED) } catch { /* ignore */ }
  },

  hasSeenTooltip(id: string): boolean {
    try {
      const raw = localStorage.getItem(KEY_TOOLTIPS_SEEN)
      if (!raw) return false
      const arr = JSON.parse(raw) as string[]
      return Array.isArray(arr) && arr.includes(id)
    } catch { return false }
  },
  markTooltipSeen(id: string) {
    try {
      const raw = localStorage.getItem(KEY_TOOLTIPS_SEEN)
      const arr: string[] = raw ? (JSON.parse(raw) as string[]) : []
      if (!arr.includes(id)) {
        arr.push(id)
        localStorage.setItem(KEY_TOOLTIPS_SEEN, JSON.stringify(arr))
      }
    } catch { /* ignore */ }
  },

  getLastChapter(): number {
    try {
      const v = localStorage.getItem(KEY_LAST_CHAPTER)
      const n = v ? parseInt(v, 10) : 0
      return Number.isFinite(n) ? n : 0
    } catch { return 0 }
  },
  setLastChapter(n: number) {
    try { localStorage.setItem(KEY_LAST_CHAPTER, String(n)) } catch { /* ignore */ }
  },

  areTipsDisabled(): boolean {
    try { return localStorage.getItem(KEY_TIPS_DISABLED) === '1' } catch { return false }
  },
  setTipsDisabled(disabled: boolean) {
    try {
      if (disabled) localStorage.setItem(KEY_TIPS_DISABLED, '1')
      else localStorage.removeItem(KEY_TIPS_DISABLED)
    } catch { /* ignore */ }
  },
}
