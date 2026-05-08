import { useSyncExternalStore } from 'react'

type Theme = 'v1' | 'v2'

const subscribe = (cb: () => void) => {
  const obs = new MutationObserver(cb)
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  return () => obs.disconnect()
}

const get = (): Theme => (document.documentElement.dataset.theme === 'v2' ? 'v2' : 'v1')

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, get, () => 'v1')
}
