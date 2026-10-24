import type { Chapter } from '../runtime/types'
import orientation from './orientation'
import objective from './objective'
import prices from './prices'
import turns from './turns'

/**
 * The guided-tutorial chapters, in play order. Data only (no `import.meta.env`)
 * so the Playwright walker can import it in Node. Chapter tasks append here.
 */
export const ORDERED: Chapter[] = [orientation, objective, prices, turns]
