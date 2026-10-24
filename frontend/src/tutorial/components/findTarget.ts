import type { TargetId } from '../runtime/types'

/**
 * First `[data-tutorial=id]` that is actually laid out (non-zero rect).
 * Both the desktop and mobile trees tag their equivalent element, and a
 * hidden copy (display:none, collapsed) must never win.
 */
export function findTarget(id: TargetId, root: ParentNode = document): HTMLElement | null {
  const matches = root.querySelectorAll<HTMLElement>(`[data-tutorial="${id}"]`)
  for (const el of matches) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) return el
  }
  return null
}
