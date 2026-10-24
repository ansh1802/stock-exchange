import type { Chapter } from '../runtime/types'

/**
 * The guided-tutorial chapters, in play order. Data only (no `import.meta.env`)
 * so the Playwright walker can import it in Node. Chapter tasks append here.
 */
export const ORDERED: Chapter[] = []
