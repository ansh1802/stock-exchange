import type { ReactNode } from 'react'

/**
 * Step copy supports `**bold**` and nothing else. Text is split, never parsed
 * as HTML. An unpaired trailing `**` is kept as literal text.
 */
export function renderBold(text: string): ReactNode[] {
  const parts = text.split('**')
  // Even part count = one unpaired marker: glue the last segment back on literally.
  if (parts.length % 2 === 0) {
    const tail = parts.pop() as string
    parts[parts.length - 1] += '**' + tail
  }
  return parts.map((p, i) =>
    i % 2 === 1 ? <strong key={i} style={{ fontWeight: 650, color: 'var(--color-ink)' }}>{p}</strong> : p,
  ).filter((p) => p !== '')
}
