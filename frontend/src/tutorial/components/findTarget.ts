import type { TargetId } from '../runtime/types'

const visible = (el: HTMLElement) => {
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0
}

/**
 * First `[data-tutorial=id]` that is actually laid out (non-zero rect).
 * Both the desktop and mobile trees tag their equivalent element, and a
 * hidden copy (display:none, collapsed) must never win. With `key`, narrows
 * to the visible descendant tagged `data-tutorial-key=<key>` (list items:
 * a company in the trade popup, a card in the chairman/director modal).
 */
export function findTarget(id: TargetId, root: ParentNode = document, key?: string): HTMLElement | null {
  for (const el of root.querySelectorAll<HTMLElement>(`[data-tutorial="${id}"]`)) {
    if (!visible(el)) continue
    if (key === undefined) return el
    for (const item of el.querySelectorAll<HTMLElement>('[data-tutorial-key]')) {
      if (item.getAttribute('data-tutorial-key') === key && visible(item)) return item
    }
  }
  return null
}
