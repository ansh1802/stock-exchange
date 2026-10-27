// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { findTarget } from './findTarget'

function tagged(id: string, rect: { width: number; height: number }): HTMLElement {
  const el = document.createElement('div')
  el.setAttribute('data-tutorial', id)
  el.getBoundingClientRect = () =>
    ({ x: 0, y: 0, top: 0, left: 0, right: rect.width, bottom: rect.height, ...rect, toJSON: () => ({}) }) as DOMRect
  document.body.appendChild(el)
  return el
}

describe('findTarget', () => {
  beforeEach(() => { document.body.innerHTML = '' })

  it('returns the tagged element when it is visible', () => {
    const el = tagged('hand', { width: 300, height: 80 })
    expect(findTarget('hand')).toBe(el)
  })

  it('skips a zero-size match and returns the next visible one', () => {
    tagged('hand', { width: 0, height: 0 }) // e.g. the hidden layout's copy
    const visible = tagged('hand', { width: 300, height: 80 })
    expect(findTarget('hand')).toBe(visible)
  })

  it('returns null when every match is zero-size or none exists', () => {
    tagged('hand', { width: 0, height: 40 })
    expect(findTarget('hand')).toBeNull()
    expect(findTarget('ticker')).toBeNull()
  })

  it('narrows to the keyed descendant when a key is given', () => {
    const grid = tagged('trade-company', { width: 300, height: 100 })
    const item = (k: string, w: number) => {
      const b = document.createElement('button')
      b.setAttribute('data-tutorial-key', k)
      b.getBoundingClientRect = () => ({ left: 0, top: 0, width: w, height: 30 }) as DOMRect
      grid.appendChild(b)
      return b
    }
    item('Cred', 90)
    const tcs = item('TCS', 90)
    expect(findTarget('trade-company', document, 'TCS')).toBe(tcs)
    expect(findTarget('trade-company', document, 'Infosys')).toBeNull()
    item('own:0', 0) // zero-size keyed item never wins
    expect(findTarget('trade-company', document, 'own:0')).toBeNull()
    expect(findTarget('trade-company')).toBe(grid)
  })

  it('searches only inside the given root', () => {
    const root = document.createElement('section')
    document.body.appendChild(root)
    tagged('log', { width: 100, height: 100 })
    expect(findTarget('log', root)).toBeNull()
  })
})
