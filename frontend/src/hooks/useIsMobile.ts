import { useEffect, useState } from 'react'

const QUERY = '(max-width: 767px)'

/**
 * Returns true when the viewport is below Tailwind's `md` breakpoint (768px).
 * SSR-safe: defaults to false on first render, then updates on mount.
 * Subscribes to `change` events so orientation flips and dev-tools resizes
 * switch layouts immediately.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(QUERY).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mql = window.matchMedia(QUERY)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mql.addEventListener('change', handler)
    setIsMobile(mql.matches)
    return () => mql.removeEventListener('change', handler)
  }, [])

  return isMobile
}
