import type { Chapter } from '../runtime/types'

export const RECAP_ID = 'recap'

/**
 * Ch 11 — Recap & first game. No fixture and no board: the player page renders
 * RecapView (every chapter's chips + the first-game button) instead of a run.
 */
const recap: Chapter = {
  id: RECAP_ID,
  title: 'Recap & first game',
  subtitle: 'Everything you learned, then a real game vs 3 Easy bots',
  minutes: 1,
  chips: [],
  steps: [{ id: 'recap', snap: 'recap', advance: { kind: 'next' } }],
}

export default recap

/** RecapView copy (kept with the chapter, per the copy-lives-in-chapters rule). */
export const RECAP_COPY = {
  eyebrow: 'Tutorial complete',
  heading: 'Your trading notes',
  intro: 'Everything you picked up, chapter by chapter. Next: a real game.',
  play: 'Play your first game vs bots',
  playHint: 'You + 3 Easy bots. It starts as soon as the room opens.',
  namePrompt: 'Your name at the table',
  replay: 'Replay a chapter',
  rulebook: 'Read the rulebook',
}
