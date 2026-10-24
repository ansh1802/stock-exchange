import type { Chapter } from '../runtime/types'
import type { GameState } from '../../types/game'
import { ORDERED } from './ordered'
import smoke from './_smoke'

export type Fixture = { chapter: string; human_id: number; snapshots: Record<string, GameState> }

/** Ordered chapter registry. `_smoke` is a dev-only harness chapter. */
export const CHAPTERS: Chapter[] = import.meta.env.DEV ? [...ORDERED, smoke] : ORDERED

export function findChapter(id: string | undefined): Chapter | undefined {
  return CHAPTERS.find((c) => c.id === id)
}

/** Lazy per-chapter fixture chunk (keeps fixtures out of the main bundle). */
export async function loadFixture(id: string): Promise<Fixture> {
  const mod = await import(`../fixtures/${id}.json`)
  return (mod.default ?? mod) as Fixture
}
