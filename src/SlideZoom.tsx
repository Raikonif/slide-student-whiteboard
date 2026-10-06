import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Slide } from './api'
import { GlassSlide } from './GlassSlide'
import { useI18n } from './i18n'

const MAX_W = 760
const GAP = 16

function useViewport() {
  const [vp, setVp] = useState({ w: innerWidth, h: innerHeight })
  useEffect(() => {
    const onResize = () => setVp({ w: innerWidth, h: innerHeight })
    addEventListener('resize', onResize)
    return () => removeEventListener('resize', onResize)
  }, [])
  return vp
}

// Transform that places a W-wide slide exactly over `rect` (where it sits on the board).
const transformFor = (rect: DOMRect, w: number) => `translate(${rect.left}px, ${rect.top}px) scale(${rect.width / w})`

// A slide grows out of its spot on the board to the centre of the screen, and shrinks back on close.
// If its learning doesn't fit on the glass, the full text is shown in a card underneath.
export function SlideZoom({
  slide,
  getRect,
  onClosed,
}: {
  slide: Slide
  // Where the slide currently is on the board (read again on close, in case it moved or the board scrolled).
  getRect: () => DOMRect | null
  onClosed: () => void
}) {
  const { t } = useI18n()
  const vp = useViewport()
  const [phase, setPhase] = useState<'enter' | 'open' | 'leave'>('enter')
  const [truncated, setTruncated] = useState(false)
  const slideRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const [startRect] = useState(getRect)
  const [endRect, setEndRect] = useState<DOMRect | null>(null)

  const w = Math.min(vp.w - 32, MAX_W)
  const h = w / 3
  // Sit a bit above centre so the learning card fits underneath.
  const top = Math.max(GAP + 48, (vp.h - h) * (truncated ? 0.3 : 0.45))
  const left = (vp.w - w) / 2

  // Is the learning cut off on the glass? (Same 4-line clamp at any size.)
  useLayoutEffect(() => {
    const el = slideRef.current?.querySelector('.slide-learning')
    // Handwriting glyphs poke a few px past the line box; real truncation hides at least a whole line.
    const lineHeight = el ? parseFloat(getComputedStyle(el).lineHeight) || 0 : 0
    setTruncated(!!el && el.scrollHeight > el.clientHeight + lineHeight / 2)
  }, [slide.learning, w])

  useEffect(() => {
    // Two frames so the starting transform is painted before transitioning to the open one.
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => (raf2 = requestAnimationFrame(() => setPhase('open'))))
    closeRef.current?.focus({ preventScroll: true })
    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
    }
  }, [])

  function close() {
    if (phase === 'leave') return
    setEndRect(getRect())
    setPhase('leave')
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  })

  // Unmount once the shrink-back finishes (or right away if motion is reduced / nothing to animate to).
  useEffect(() => {
    if (phase !== 'leave') return
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = window.setTimeout(onClosed, reduced || !endRect ? 0 : 480)
    return () => window.clearTimeout(timer)
  }, [phase, endRect, onClosed])

  const fromRect = phase === 'leave' ? endRect : startRect
  const transform =
    phase === 'open' || !fromRect ? `translate(${left}px, ${top}px) scale(1)` : transformFor(fromRect, w)
  const isOpen = phase === 'open'

  return (
    <div role="dialog" aria-modal="true" aria-label={slide.fullName}>
      <div className={`zoom-backdrop${isOpen ? ' open' : ''}`} onClick={close} />
      <div
        ref={slideRef}
        className="zoom-slide"
        style={{ width: w, height: h, transform, opacity: !fromRect && !isOpen ? 0 : 1 }}
        onClick={close}
      >
        <GlassSlide id={slide.id} name={slide.fullName} learning={slide.learning} />
      </div>
      {truncated && (
        <div className={`zoom-panel${isOpen ? ' open' : ''}`} style={{ top: top + h + GAP }}>
          <div className="card">
            <span className="eyebrow">{t('board.learned')}</span>
            <p className="learning-full">{slide.learning}</p>
          </div>
        </div>
      )}
      <button
        ref={closeRef}
        type="button"
        className={`btn btn-secondary btn-sm zoom-close${isOpen ? ' open' : ''}`}
        onClick={close}
        aria-label={t('common.close')}
        title={t('board.closeHint')}
      >
        ✕ {t('common.close')}
      </button>
    </div>
  )
}
