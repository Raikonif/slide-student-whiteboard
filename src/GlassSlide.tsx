import { useLayoutEffect, useMemo, useRef } from 'react'

// Deterministic PRNG so each slide's tissue sample looks the same on every render/device.
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// An irregular closed blob around (cx, cy), smoothed with quadratic curves.
function blobPath(rand: () => number, cx: number, cy: number, rx: number, ry: number) {
  const n = 10
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    const r = 0.7 + rand() * 0.35
    return [cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r]
  })
  const mid = (a: number[], b: number[]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  let d = `M ${mid(pts[n - 1], pts[0]).join(' ')}`
  for (let i = 0; i < n; i++) {
    const p = pts[i]
    const m = mid(p, pts[(i + 1) % n])
    d += ` Q ${p[0].toFixed(1)} ${p[1].toFixed(1)} ${m[0].toFixed(1)} ${m[1].toFixed(1)}`
  }
  return d + ' Z'
}

// Eosin pinks with a little variation between samples.
const STAINS = ['#e8a0bf', '#e59ab8', '#eba8c4', '#df94b4', '#e6a6c6']

function Tissue({ seed }: { seed: number }) {
  const sample = useMemo(() => {
    const rand = mulberry32(seed * 9973 + 17)
    const outline = blobPath(rand, 50, 30, 40, 24)
    const inner = blobPath(rand, 46 + rand() * 8, 30, 22, 13)
    const nuclei = Array.from({ length: 70 }, () => ({
      x: 8 + rand() * 84,
      y: 4 + rand() * 52,
      r: 0.6 + rand() * 1.1,
      o: 0.45 + rand() * 0.45,
    }))
    return { outline, inner, nuclei, stain: STAINS[Math.floor(rand() * STAINS.length)] }
  }, [seed])

  const clipId = `tissue-${seed}`
  return (
    <svg className="tissue" viewBox="0 0 100 60" aria-hidden="true">
      <defs>
        <clipPath id={clipId}>
          <path d={sample.outline} />
        </clipPath>
      </defs>
      <path d={sample.outline} fill={sample.stain} opacity="0.82" />
      <g clipPath={`url(#${clipId})`}>
        <path d={sample.inner} fill="#c97aa8" opacity="0.45" />
        {sample.nuclei.map((n, i) => (
          <circle key={i} cx={n.x} cy={n.y} r={n.r} fill="#5b3a8c" opacity={n.o} />
        ))}
      </g>
    </svg>
  )
}

// Fixed slide size on the whiteboard canvas (3:1, like a real 75 x 25 mm slide).
export const SLIDE_W = 360
export const SLIDE_H = 120

// Shrinks the name until all of it fits in the label (sizes are relative to the slide height).
function useFitText(text: string) {
  const ref = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const fit = () => {
      const h = el.parentElement?.clientHeight ?? 0
      if (!h) return
      let size = h * 0.3
      el.style.fontSize = `${size}px`
      while (size > h * 0.1 && (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1)) {
        size -= h * 0.01
        el.style.fontSize = `${size}px`
      }
    }
    fit()
    // Re-fit once the handwriting font has loaded, since it changes text width.
    let alive = true
    document.fonts?.ready.then(() => alive && fit())
    return () => {
      alive = false
    }
  }, [text])
  return ref
}

export function GlassSlide({ id, name, learning }: { id: number; name: string; learning: string }) {
  const nameRef = useFitText(name)
  return (
    <div className="glass-slide" title={learning ? `${name}\n\n${learning}` : name}>
      <div className="slide-label">
        <span className="slide-name" ref={nameRef}>
          {name}
        </span>
      </div>
      <div className="cover-slip">
        <Tissue seed={id} />
        {learning && <p className="slide-learning">{learning}</p>}
      </div>
    </div>
  )
}
