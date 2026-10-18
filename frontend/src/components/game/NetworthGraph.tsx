import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
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
  // Optional title bits — caller controls layout chrome around the SVG.
  title?: string
  pillText?: string
  ssApplied?: boolean
  // Fill the parent's height (parent must be a bounded flex/grid cell).
  fill?: boolean
}

/**
 * Animation model — declarative, data-driven.
 *
 * The chart is plain React SVG with framer-motion on the few elements that
 * move. Nothing is keyed on prop identity: the entry travel plays once per
 * `currentDay` (elements are keyed on it so a new day mounts fresh), and a
 * Trigger B re-snapshot (share-suspend swap) only changes the *target* of the
 * last segment / dot / label, which framer-motion tweens from wherever they
 * are. Re-renders with identical numbers are no-ops. This replaces the old
 * imperative `useEffect` that rebuilt and restarted the whole SVG whenever
 * `history` / `players` got a new array identity — i.e. on every broadcast.
 */
export const TRAVEL_MS = 3200
const SWAP_MS = 900
const EASE = [0.4, 0, 0.4, 1] as const

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
  return pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ')
}

function readNW(snap: Record<string, number> | undefined, id: number): number | null {
  if (!snap) return null
  const v = snap[String(id)]
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

const TICK_CANDIDATES = [500, 1000, 2000, 3000, 5000, 7500, 10000, 15000, 25000]

function NetworthGraph({
  history,
  currentDay,
  players,
  activePlayerId,
  viewport,
  title,
  pillText,
  ssApplied,
  fill = false,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const reduced = useReducedMotion() ?? false
  const compact = viewport === 'mobile'

  // Measure the host so the SVG scales with whatever height the layout gives it.
  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return
    const measure = () => {
      const r = host.getBoundingClientRect()
      setSize((s) => {
        const w = Math.round(r.width)
        const h = Math.round(r.height)
        return s.w === w && s.h === h ? s : { w, h }
      })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(host)
    return () => ro.disconnect()
  }, [])

  // Once the entry travel for this day has finished, later re-targets (swaps)
  // tween at the quicker SWAP_MS so the standings "settle" rather than re-run.
  const [travelDoneDay, setTravelDoneDay] = useState(-1)
  useEffect(() => {
    const t = window.setTimeout(() => setTravelDoneDay(currentDay), TRAVEL_MS + 50)
    return () => window.clearTimeout(t)
  }, [currentDay])
  const travelDone = travelDoneDay === currentDay
  const moveS = reduced ? 0 : (travelDone ? SWAP_MS : TRAVEL_MS) / 1000
  const travelS = reduced ? 0 : TRAVEL_MS / 1000

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

  const geo = useMemo(() => {
    const W = Math.max(size.w, 120)
    const H = Math.max(size.h, compact ? 120 : 160)
    const PAD_L = compact ? 30 : 42
    const PAD_R = compact ? 62 : 84
    const PAD_T = 12
    const PAD_B = 22

    let maxNW = 600
    for (let d = 0; d <= currentDay; d++) {
      const snap = history[d]
      if (!snap) continue
      for (const p of players) {
        const v = readNW(snap, p.id)
        if (v != null && v > maxNW) maxNW = v
      }
    }
    const yMin = 300
    const yMax = maxNW * 1.18
    const x = scaleLin(0, currentDay, PAD_L, W - PAD_R)
    const y = scaleLog(yMin, yMax, H - PAD_B, PAD_T)

    const yTicks = TICK_CANDIDATES.filter((t) => t >= yMin && t <= yMax).map((t) => ({ t, y: y(t) }))
    const xTicks: Array<{ d: number; x: number }> = []
    for (let d = 0; d <= currentDay; d++) xTicks.push({ d, x: x(d) })

    const prevSnap = history[Math.max(0, currentDay - 1)] ?? {}
    const currSnap = history[currentDay] ?? {}
    const overtakers = new Set<number>()
    for (const a of players) {
      for (const b of players) {
        if (a.id === b.id) continue
        const av0 = readNW(prevSnap, a.id)
        const bv0 = readNW(prevSnap, b.id)
        const av1 = readNW(currSnap, a.id)
        const bv1 = readNW(currSnap, b.id)
        if (av0 == null || bv0 == null || av1 == null || bv1 == null) continue
        if (av0 < bv0 && av1 > bv1) overtakers.add(a.id)
      }
    }

    // Fixed seat order (by id), independent of how the caller orders `players`.
    // Reordering keyed <g>s moves DOM nodes, and a moved <path> restarts its
    // in-flight travel — so the order must never change while mounted. The
    // active halo is drawn in its own layer instead of via z-order.
    const series = players
      .slice()
      .sort((a, b) => a.id - b.id)
      .map((p) => {
        const pts: Array<[number, number]> = []
        for (let d = 0; d <= currentDay; d++) {
          const v = readNW(history[d], p.id)
          if (v == null) continue
          pts.push([x(d), y(v)])
        }
        if (pts.length === 0) return null
        const last = pts[pts.length - 1]
        const start = pts.length > 1 ? pts[pts.length - 2] : last
        return {
          player: p,
          isActive: p.id === activePlayerId,
          color: playerColor(p.id),
          staticD: pts.length > 2 ? toPath(pts.slice(0, -1)) : null,
          segD: pts.length > 1 ? toPath(pts.slice(-2)) : null,
          haloD: pts.length > 1 ? toPath(pts) : null,
          start,
          last,
          overtook: overtakers.has(p.id),
        }
      })
      .filter((s): s is NonNullable<typeof s> => s !== null)

    // Name labels sit beside the final dot; players with (near-)equal networth
    // would print on top of each other, so push label rows apart vertically.
    const LABEL_GAP = compact ? 10 : 11
    const byY = series.map((s) => ({ s, ly: s.last[1] })).sort((a, b) => a.ly - b.ly)
    for (let i = 1; i < byY.length; i++) {
      if (byY[i].ly - byY[i - 1].ly < LABEL_GAP) byY[i].ly = byY[i - 1].ly + LABEL_GAP
    }
    const labelY = new Map(byY.map(({ s, ly }) => [s.player.id, ly]))

    return { W, H, PAD_L, PAD_R, PAD_T, PAD_B, yTicks, xTicks, series, labelY }
  }, [size, compact, history, currentDay, players, activePlayerId])

  const { W, H, PAD_L, PAD_R, PAD_T, PAD_B } = geo
  const fontSize = compact ? 8 : 10
  const labelFont = compact ? 9 : 10

  return (
    <div
      className={
        'rounded-lg border border-amber-500/15 bg-black/30 flex flex-col min-h-0 ' +
        (compact ? 'p-2.5' : 'p-3.5') +
        (fill ? ' h-full' : '')
      }
    >
      {(title || pillText) && (
        <div className="flex items-baseline justify-between gap-3 mb-1.5 shrink-0">
          <div className="flex items-baseline gap-2 min-w-0">
            {title && (
              <div
                className={(compact ? 'text-sm' : 'text-base') + ' text-amber-50/90 leading-tight truncate'}
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {title}
              </div>
            )}
            <div className="text-[9px] tracking-[0.15em] text-amber-400/80 font-mono whitespace-nowrap">
              NETWORTH · LOG
            </div>
          </div>
          {pillText && (
            <span
              className={
                'px-2 py-0.5 rounded-full text-[10px] tracking-[0.1em] font-mono border whitespace-nowrap ' +
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

      {/* Plot — fills the remaining height; SVG is sized from the measured host. */}
      <div
        ref={hostRef}
        className="relative flex-1 min-h-0 w-full"
        style={{ minHeight: fill ? 0 : compact ? 170 : 220 }}
      >
        {size.w > 0 && (
          <svg
            width={W}
            height={H}
            viewBox={`0 0 ${W} ${H}`}
            className="absolute inset-0 overflow-visible"
            aria-label="Networth standings by day"
          >
            {geo.yTicks.map(({ t, y }) => (
              <g key={t}>
                <motion.line
                  x1={PAD_L}
                  x2={W - PAD_R}
                  initial={false}
                  animate={{ y1: y, y2: y }}
                  transition={{ duration: moveS, ease: EASE }}
                  stroke="rgba(201,161,74,0.12)"
                  strokeWidth={1}
                  strokeDasharray="2 4"
                />
                <motion.text
                  initial={false}
                  animate={{ attrX: PAD_L - 6, attrY: y + 3 }}
                  transition={{ duration: moveS, ease: EASE }}
                  textAnchor="end"
                  fontFamily="JetBrains Mono, ui-monospace, monospace"
                  fontSize={fontSize}
                  fill="rgba(201,161,74,0.45)"
                >
                  {t >= 1000 ? `${t / 1000}k` : t}
                </motion.text>
              </g>
            ))}

            {geo.xTicks.map(({ d, x }) => (
              <g key={d}>
                <line x1={x} x2={x} y1={H - PAD_B} y2={H - PAD_B + 3} stroke="rgba(201,161,74,0.4)" />
                <text
                  x={x}
                  y={H - PAD_B + 13}
                  textAnchor="middle"
                  fontFamily="JetBrains Mono, ui-monospace, monospace"
                  fontSize={fontSize}
                  fill="rgba(201,161,74,0.55)"
                >
                  D{d}
                </text>
              </g>
            ))}

            <line x1={PAD_L} x2={W - PAD_R} y1={H - PAD_B} y2={H - PAD_B} stroke="rgba(201,161,74,0.3)" />
            <line x1={PAD_L} x2={PAD_L} y1={PAD_T} y2={H - PAD_B} stroke="rgba(201,161,74,0.3)" />

            {/* Halo layer — one soft glow under the active player's whole line. */}
            {geo.series.map((s) =>
              s.isActive && s.haloD ? (
                // Travels with the line during the day's entry; when the active
                // player changes later it just fades in on the finished line.
                <motion.path
                  key={`halo-${s.player.id}-${currentDay}`}
                  initial={{ pathLength: travelDone ? 1 : 0, opacity: 0, d: s.haloD }}
                  animate={{ pathLength: 1, opacity: 1, d: s.haloD }}
                  transition={{
                    pathLength: { duration: travelS, ease: EASE },
                    opacity: { duration: 0.35 },
                    d: { duration: moveS, ease: EASE },
                  }}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={7}
                  strokeOpacity={0.18}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null,
            )}

            {geo.series.map((s) => {
              const sw = s.isActive ? 3 : 2
              const r = s.isActive ? 5 : 4
              return (
                <g key={s.player.id}>
                  {s.staticD && (
                    <motion.path
                      initial={false}
                      animate={{ d: s.staticD }}
                      transition={{ duration: moveS, ease: EASE }}
                      fill="none"
                      stroke={s.color}
                      strokeWidth={sw}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                  {s.segD && (
                    // Keyed on the day: mounts fresh (and travels once) per new
                    // snapshot day; swaps only re-target `d`.
                    <motion.path
                      key={`seg-${currentDay}`}
                      initial={{ pathLength: 0, d: s.segD }}
                      animate={{ pathLength: 1, d: s.segD }}
                      transition={{
                        pathLength: { duration: travelS, ease: EASE },
                        d: { duration: moveS, ease: EASE },
                      }}
                      fill="none"
                      stroke={s.color}
                      strokeWidth={sw}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                  {s.overtook && !reduced && (
                    <motion.circle
                      key={`ring-${currentDay}`}
                      initial={{ cx: s.start[0], cy: s.start[1], r, opacity: 0, strokeWidth: 2 }}
                      animate={{
                        cx: s.last[0],
                        cy: s.last[1],
                        r: [r, r, r * 2.8],
                        opacity: [0, 0, 0.9, 0],
                        strokeWidth: [2, 2, 1],
                      }}
                      transition={{
                        cx: { duration: moveS, ease: EASE },
                        cy: { duration: moveS, ease: EASE },
                        r: { delay: travelS - 0.25, duration: 0.6, times: [0, 0.05, 1] },
                        opacity: { delay: travelS - 0.25, duration: 0.6, times: [0, 0.05, 0.5, 1] },
                        strokeWidth: { delay: travelS - 0.25, duration: 0.6, times: [0, 0.05, 1] },
                      }}
                      fill="none"
                      stroke="#e6c474"
                    />
                  )}
                  <motion.circle
                    key={`dot-${currentDay}`}
                    initial={{ cx: s.start[0], cy: s.start[1] }}
                    animate={{ cx: s.last[0], cy: s.last[1] }}
                    transition={{ duration: moveS, ease: EASE }}
                    r={r}
                    fill="#0e1a14"
                    stroke={s.color}
                    strokeWidth={s.isActive ? 2.5 : 2}
                  />
                  <motion.text
                    key={`chip-${currentDay}`}
                    initial={{ opacity: 0, attrX: s.start[0] + 8, attrY: s.start[1] + 3 }}
                    animate={{
                      opacity: 1,
                      attrX: s.last[0] + 8,
                      attrY: (geo.labelY.get(s.player.id) ?? s.last[1]) + 3,
                    }}
                    transition={{
                      opacity: { duration: 0.4 },
                      attrX: { duration: moveS, ease: EASE },
                      attrY: { duration: moveS, ease: EASE },
                    }}
                    fontFamily="JetBrains Mono, ui-monospace, monospace"
                    fontSize={labelFont}
                    fontWeight={s.isActive ? 700 : 500}
                    fill={s.color}
                    paintOrder="stroke"
                    stroke="#0e1a14"
                    strokeWidth={3}
                  >
                    {s.player.name}
                  </motion.text>
                </g>
              )
            })}
          </svg>
        )}
      </div>

      {/* Legend — leader first, delta vs. previous day. One wrapping row so it
          costs ~1 line of height instead of a 3-column block. */}
      <div className="mt-1.5 pt-1.5 border-t border-amber-500/10 flex flex-wrap gap-x-4 gap-y-1 shrink-0">
        {legendRows.map(({ player, value, delta }) => {
          const color = playerColor(player.id)
          const active = player.id === activePlayerId
          return (
            <div key={player.id} className="flex items-center gap-1.5 text-[11px] text-amber-50/90 min-w-0">
              <span className="inline-block w-2 h-2 rounded-sm shrink-0" style={{ background: color }} />
              <span
                className="truncate max-w-[7rem]"
                style={{ fontWeight: active ? 700 : 500, color: active ? '#e6c474' : undefined }}
              >
                {player.name}
                {player.isYou ? ' (you)' : ''}
              </span>
              <span className="font-mono text-[10px] shrink-0" style={{ color: '#e6c474' }}>
                ₹{formatRupees(value)}
              </span>
              {delta != null && (
                <span
                  className={
                    'font-mono text-[10px] shrink-0 ' +
                    (delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-red-400' : 'text-gray-500')
                  }
                >
                  {formatDelta(delta)}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default NetworthGraph
