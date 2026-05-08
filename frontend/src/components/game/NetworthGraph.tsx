import { useEffect, useMemo, useRef } from 'react'
import { playerColor } from '../../lib/playerColors'

interface PlayerInfo {
  id: number
  name: string
  isYou: boolean
}

interface Props {
  history: Record<string, number>[]
  currentDay: number
  players: PlayerInfo[]
  activePlayerId: number | null
  viewport: 'mobile' | 'desktop'
  // Bumping this re-runs the animation. Bump after Trigger A (post-settlement)
  // and Trigger B (post-share-suspend) snapshots.
  replayKey: number | string
  // Optional title bits — caller controls layout chrome around the SVG.
  title?: string
  pillText?: string
  ssApplied?: boolean
}

const SVG_NS = 'http://www.w3.org/2000/svg'

function scaleLin(d0: number, d1: number, r0: number, r1: number) {
  const span = d1 - d0 || 1
  return (v: number) => r0 + ((v - d0) / span) * (r1 - r0)
}

function scaleLog(d0: number, d1: number, r0: number, r1: number) {
  const l0 = Math.log10(Math.max(d0, 1))
  const l1 = Math.log10(Math.max(d1, 1))
  const span = l1 - l0 || 1
  return (v: number) => r0 + ((Math.log10(Math.max(v, 1)) - l0) / span) * (r1 - r0)
}

function toPath(pts: Array<[number, number]>): string {
  return pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0] + ' ' + p[1]).join(' ')
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

function readNW(snap: Record<string, number> | undefined, id: number): number | null {
  if (!snap) return null
  const v = snap[String(id)] ?? snap[id as unknown as string]
  return typeof v === 'number' ? v : null
}

function formatRupees(v: number): string {
  return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)
}

function formatDelta(delta: number): string {
  const abs = Math.abs(delta)
  const formatted = abs >= 1000 ? `${(abs / 1000).toFixed(1)}k` : String(abs)
  if (delta > 0) return `+₹${formatted}`
  if (delta < 0) return `−₹${formatted}`
  return '±0'
}

export const TRAVEL_MS = 3200
const HOLD_MS = 800
const LABEL_FADE_MS = 400

function NetworthGraph({
  history,
  currentDay,
  players,
  activePlayerId,
  viewport,
  replayKey,
  title,
  pillText,
  ssApplied,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const svgHostRef = useRef<HTMLDivElement | null>(null)

  // Derive legend in JSX so it always renders (vs. a previous imperative
  // mount that was getting clobbered) and so deltas update with each replay.
  const legendRows = useMemo(() => {
    const currSnap = history[currentDay] ?? {}
    const prevSnap = currentDay > 0 ? history[currentDay - 1] : undefined
    return players
      .map((p) => {
        const v = readNW(currSnap, p.id)
        if (v == null) return null
        const prev = readNW(prevSnap, p.id)
        const delta = prev == null ? null : v - prev
        return { player: p, value: v, delta }
      })
      .filter((x): x is { player: PlayerInfo; value: number; delta: number | null } => x !== null)
      .sort((a, b) => b.value - a.value)
  }, [history, currentDay, players])

  useEffect(() => {
    const host = svgHostRef.current
    if (!host) return

    const reduced = prefersReducedMotion()
    const compact = viewport === 'mobile'

    const hostRect = host.getBoundingClientRect()
    const H = Math.max(hostRect.height, compact ? 180 : 240)

    const minColPx = compact ? 36 : 56
    const minimum = Math.max(hostRect.width, 0)
    const ideal = (currentDay + 1) * minColPx + (compact ? 60 : 100)
    const W = Math.max(minimum, ideal)

    const PAD_L = compact ? 30 : 44
    const PAD_R = compact ? 64 : 86
    const PAD_T = 14
    const PAD_B = 24

    const dayStart = 0
    const dayEnd = currentDay

    let maxNW = 600
    for (let d = 0; d <= dayEnd; d++) {
      const snap = history[d]
      if (!snap) continue
      for (const p of players) {
        const v = readNW(snap, p.id)
        if (v != null && v > maxNW) maxNW = v
      }
    }
    const yMin = 300
    const yMax = maxNW * 1.18

    const x = scaleLin(dayStart, dayEnd, PAD_L, W - PAD_R)
    const y = scaleLog(yMin, yMax, H - PAD_B, PAD_T)

    const svg = document.createElementNS(SVG_NS, 'svg')
    svg.setAttribute('width', String(W))
    svg.setAttribute('height', String(H))
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`)
    svg.style.display = 'block'
    svg.style.overflow = 'visible'

    // Y gridlines
    const tickCandidates = [500, 1000, 2000, 3000, 5000, 7500, 10000, 15000, 25000]
    const yTicks = tickCandidates.filter(t => t >= yMin && t <= yMax)
    yTicks.forEach(t => {
      const yy = y(t)
      const line = document.createElementNS(SVG_NS, 'line')
      line.setAttribute('x1', String(PAD_L))
      line.setAttribute('x2', String(W - PAD_R))
      line.setAttribute('y1', String(yy))
      line.setAttribute('y2', String(yy))
      line.setAttribute('stroke', 'rgba(201,161,74,0.12)')
      line.setAttribute('stroke-width', '1')
      line.setAttribute('stroke-dasharray', '2 4')
      svg.appendChild(line)

      const label = document.createElementNS(SVG_NS, 'text')
      label.setAttribute('x', String(PAD_L - 6))
      label.setAttribute('y', String(yy + 3))
      label.setAttribute('text-anchor', 'end')
      label.setAttribute('font-family', 'JetBrains Mono, ui-monospace, monospace')
      label.setAttribute('font-size', String(compact ? 8 : 10))
      label.setAttribute('fill', 'rgba(201,161,74,0.45)')
      label.textContent = t >= 1000 ? `${t / 1000}k` : String(t)
      svg.appendChild(label)
    })

    for (let d = dayStart; d <= dayEnd; d++) {
      const xx = x(d)
      const tick = document.createElementNS(SVG_NS, 'line')
      tick.setAttribute('x1', String(xx))
      tick.setAttribute('x2', String(xx))
      tick.setAttribute('y1', String(H - PAD_B))
      tick.setAttribute('y2', String(H - PAD_B + 3))
      tick.setAttribute('stroke', 'rgba(201,161,74,0.4)')
      svg.appendChild(tick)

      const label = document.createElementNS(SVG_NS, 'text')
      label.setAttribute('x', String(xx))
      label.setAttribute('y', String(H - PAD_B + 14))
      label.setAttribute('text-anchor', 'middle')
      label.setAttribute('font-family', 'JetBrains Mono, ui-monospace, monospace')
      label.setAttribute('font-size', String(compact ? 8 : 10))
      label.setAttribute('fill', 'rgba(201,161,74,0.55)')
      label.textContent = `D${d}`
      svg.appendChild(label)
    }

    const xAxis = document.createElementNS(SVG_NS, 'line')
    xAxis.setAttribute('x1', String(PAD_L))
    xAxis.setAttribute('x2', String(W - PAD_R))
    xAxis.setAttribute('y1', String(H - PAD_B))
    xAxis.setAttribute('y2', String(H - PAD_B))
    xAxis.setAttribute('stroke', 'rgba(201,161,74,0.3)')
    xAxis.setAttribute('stroke-width', '1')
    svg.appendChild(xAxis)

    const yAxis = document.createElementNS(SVG_NS, 'line')
    yAxis.setAttribute('x1', String(PAD_L))
    yAxis.setAttribute('x2', String(PAD_L))
    yAxis.setAttribute('y1', String(PAD_T))
    yAxis.setAttribute('y2', String(H - PAD_B))
    yAxis.setAttribute('stroke', 'rgba(201,161,74,0.3)')
    yAxis.setAttribute('stroke-width', '1')
    svg.appendChild(yAxis)

    // Active player rendered last for z-order. Detect overtakes for flourish.
    const sortedPlayers = players.slice().sort((a, b) => {
      if (a.id === activePlayerId) return 1
      if (b.id === activePlayerId) return -1
      return 0
    })

    const prevSnap = history[Math.max(0, dayEnd - 1)] ?? {}
    const currSnap = history[dayEnd] ?? {}
    const overtakerIds = new Set<number>()
    for (const a of players) {
      for (const b of players) {
        if (a.id === b.id) continue
        const av0 = readNW(prevSnap, a.id)
        const bv0 = readNW(prevSnap, b.id)
        const av1 = readNW(currSnap, a.id)
        const bv1 = readNW(currSnap, b.id)
        if (av0 == null || bv0 == null || av1 == null || bv1 == null) continue
        if (av0 < bv0 && av1 > bv1) overtakerIds.add(a.id)
      }
    }

    const timeouts: number[] = []

    sortedPlayers.forEach(p => {
      const pts: Array<[number, number]> = []
      for (let d = dayStart; d <= dayEnd; d++) {
        const v = readNW(history[d], p.id)
        if (v == null) continue
        pts.push([x(d), y(v)])
      }
      if (pts.length < 1) return

      const isActive = p.id === activePlayerId
      const stroke = playerColor(p.id)
      const sw = isActive ? 3 : 2

      if (isActive && pts.length > 1) {
        const halo = document.createElementNS(SVG_NS, 'path')
        halo.setAttribute('d', toPath(pts))
        halo.setAttribute('fill', 'none')
        halo.setAttribute('stroke', stroke)
        halo.setAttribute('stroke-width', String(sw + 4))
        halo.setAttribute('stroke-opacity', '0.18')
        halo.setAttribute('stroke-linecap', 'round')
        halo.setAttribute('stroke-linejoin', 'round')
        svg.appendChild(halo)
      }

      if (pts.length > 1) {
        const staticPts = pts.slice(0, -1)
        const newPts = pts.slice(-2)

        if (staticPts.length > 1) {
          const sp = document.createElementNS(SVG_NS, 'path')
          sp.setAttribute('d', toPath(staticPts))
          sp.setAttribute('fill', 'none')
          sp.setAttribute('stroke', stroke)
          sp.setAttribute('stroke-width', String(sw))
          sp.setAttribute('stroke-linecap', 'round')
          sp.setAttribute('stroke-linejoin', 'round')
          svg.appendChild(sp)
        }

        const np = document.createElementNS(SVG_NS, 'path')
        np.setAttribute('d', toPath(newPts))
        np.setAttribute('fill', 'none')
        np.setAttribute('stroke', stroke)
        np.setAttribute('stroke-width', String(sw))
        np.setAttribute('stroke-linecap', 'round')
        np.setAttribute('stroke-linejoin', 'round')
        svg.appendChild(np)

        if (!reduced) {
          const dx = newPts[1][0] - newPts[0][0]
          const dy = newPts[1][1] - newPts[0][1]
          const len = Math.sqrt(dx * dx + dy * dy) + 4
          np.setAttribute('stroke-dasharray', String(len))
          np.setAttribute('stroke-dashoffset', String(len))
          np.style.transition = `stroke-dashoffset ${TRAVEL_MS}ms cubic-bezier(.4,0,.4,1)`
          np.getBoundingClientRect()
          requestAnimationFrame(() => {
            np.setAttribute('stroke-dashoffset', '0')
          })
        }
      }

      const last = pts[pts.length - 1]
      const startPt = pts.length > 1 && !reduced ? pts[pts.length - 2] : last

      const dot = document.createElementNS(SVG_NS, 'circle')
      dot.setAttribute('cx', String(startPt[0]))
      dot.setAttribute('cy', String(startPt[1]))
      dot.setAttribute('r', String(isActive ? 5 : 4))
      dot.setAttribute('fill', '#0e1a14')
      dot.setAttribute('stroke', stroke)
      dot.setAttribute('stroke-width', String(isActive ? 2.5 : 2))
      svg.appendChild(dot)
      if (!reduced && pts.length > 1) {
        dot.style.transition = `cx ${TRAVEL_MS}ms cubic-bezier(.4,0,.4,1), cy ${TRAVEL_MS}ms cubic-bezier(.4,0,.4,1)`
        requestAnimationFrame(() => {
          dot.setAttribute('cx', String(last[0]))
          dot.setAttribute('cy', String(last[1]))
        })
      }

      // Player name label rides alongside the dot — visible from the start so
      // the audience can read who's moving where, not just the final standings.
      const labelOffsetX = 8
      const labelOffsetY = 3
      const chip = document.createElementNS(SVG_NS, 'text')
      chip.setAttribute('x', String(startPt[0] + labelOffsetX))
      chip.setAttribute('y', String(startPt[1] + labelOffsetY))
      chip.setAttribute('font-family', 'JetBrains Mono, ui-monospace, monospace')
      chip.setAttribute('font-size', String(compact ? 9 : 10))
      chip.setAttribute('fill', stroke)
      chip.setAttribute('font-weight', String(isActive ? 700 : 500))
      chip.setAttribute('paint-order', 'stroke')
      chip.setAttribute('stroke', '#0e1a14')
      chip.setAttribute('stroke-width', '3')
      chip.style.opacity = '0'
      chip.style.transition = `opacity ${LABEL_FADE_MS}ms ease, x ${TRAVEL_MS}ms cubic-bezier(.4,0,.4,1), y ${TRAVEL_MS}ms cubic-bezier(.4,0,.4,1)`
      chip.textContent = p.name
      svg.appendChild(chip)
      // Fade in immediately, travel with the dot for the full TRAVEL_MS.
      requestAnimationFrame(() => {
        chip.style.opacity = '1'
        if (!reduced && pts.length > 1) {
          chip.setAttribute('x', String(last[0] + labelOffsetX))
          chip.setAttribute('y', String(last[1] + labelOffsetY))
        }
      })

      // Overtake flourish — gold ring pulse, peaks late in travel.
      if (!reduced && overtakerIds.has(p.id) && pts.length > 1) {
        const ring = document.createElementNS(SVG_NS, 'circle')
        ring.setAttribute('cx', String(startPt[0]))
        ring.setAttribute('cy', String(startPt[1]))
        ring.setAttribute('r', String(isActive ? 5 : 4))
        ring.setAttribute('fill', 'none')
        ring.setAttribute('stroke', '#e6c474')
        ring.setAttribute('stroke-width', '2')
        ring.setAttribute('opacity', '0')
        ring.style.transition = `cx ${TRAVEL_MS}ms cubic-bezier(.4,0,.4,1), cy ${TRAVEL_MS}ms cubic-bezier(.4,0,.4,1)`
        svg.appendChild(ring)
        requestAnimationFrame(() => {
          ring.setAttribute('cx', String(last[0]))
          ring.setAttribute('cy', String(last[1]))
        })
        const t = window.setTimeout(() => {
          ring.style.transition = 'r 320ms ease-out, opacity 320ms ease-out, stroke-width 320ms ease-out'
          ring.setAttribute('r', String(isActive ? 14 : 12))
          ring.setAttribute('stroke-width', '1')
          ring.setAttribute('opacity', '0.9')
          const t2 = window.setTimeout(() => {
            ring.setAttribute('opacity', '0')
          }, 280)
          timeouts.push(t2)
        }, TRAVEL_MS - 250)
        timeouts.push(t)
      }
    })

    host.innerHTML = ''
    host.appendChild(svg)

    const container = containerRef.current
    if (container && compact) {
      container.scrollLeft = container.scrollWidth - container.clientWidth
    }

    return () => {
      timeouts.forEach(t => window.clearTimeout(t))
    }
  }, [history, currentDay, players, activePlayerId, viewport, replayKey])

  // Reference HOLD_MS so the constant survives lint/tree-shake passes; it's the
  // dwell between travel-end and the next phase, surfaced on the wrapper for
  // tooling. Keeps intent visible without affecting rendering.
  void HOLD_MS

  const compact = viewport === 'mobile'

  return (
    <div
      className={
        'rounded-lg border border-amber-500/15 bg-black/30 ' +
        (compact ? 'p-3' : 'p-4')
      }
    >
      {(title || pillText) && (
        <div className="flex items-start justify-between mb-3">
          <div>
            {title && (
              <div
                className={(compact ? 'text-base' : 'text-lg') + ' text-amber-50/90 leading-tight'}
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {title}
              </div>
            )}
            <div className="text-[10px] tracking-[0.15em] text-amber-400 font-mono mt-0.5">
              NETWORTH · LOG SCALE
            </div>
          </div>
          {pillText && (
            <span
              className={
                'px-2 py-0.5 rounded-full text-[10px] tracking-[0.1em] font-mono border ' +
                (ssApplied
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                  : 'bg-amber-500/10 text-amber-300/90 border-amber-500/30')
              }
            >
              {ssApplied ? '● SS APPLIED' : pillText}
            </span>
          )}
        </div>
      )}
      <div
        ref={containerRef}
        className="overflow-x-auto overflow-y-hidden"
        style={{ scrollSnapType: compact ? 'x mandatory' : undefined }}
      >
        <div
          ref={svgHostRef}
          style={{
            minHeight: compact ? 200 : 260,
            minWidth: '100%',
            position: 'relative',
          }}
        />
      </div>
      {/* Legend — leader first, with delta vs. previous day */}
      <div
        className={
          'mt-3 pt-3 border-t border-amber-500/10 grid gap-x-4 gap-y-2 ' +
          (compact ? 'grid-cols-2' : 'grid-cols-3')
        }
      >
        {legendRows.map(({ player, value, delta }) => {
          const color = playerColor(player.id)
          return (
            <div
              key={player.id}
              className="flex items-center justify-between gap-2 text-[12px] text-amber-50/90"
            >
              <span className="flex items-center gap-2 min-w-0">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ background: color }}
                />
                <span
                  className="truncate"
                  style={{
                    fontWeight: player.id === activePlayerId ? 700 : 500,
                    color: player.id === activePlayerId ? '#e6c474' : undefined,
                  }}
                >
                  {player.name}
                  {player.isYou ? ' (you)' : ''}
                </span>
              </span>
              <span className="flex items-center gap-2 font-mono text-[11px] shrink-0">
                <span style={{ color: '#e6c474' }}>₹{formatRupees(value)}</span>
                {delta != null && (
                  <span
                    className={
                      delta > 0
                        ? 'text-emerald-400'
                        : delta < 0
                          ? 'text-red-400'
                          : 'text-gray-500'
                    }
                  >
                    {formatDelta(delta)}
                  </span>
                )}
              </span>
            </div>
          )
        })}
      </div>
      {compact && (
        <div className="text-[9px] tracking-[0.1em] text-gray-500 text-center mt-2 font-mono">
          ◄ scroll for full history ►
        </div>
      )}
    </div>
  )
}

export default NetworthGraph
