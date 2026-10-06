import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { fetchSlides, getMe, moveSlide, type Slide } from './api'
import { GlassSlide, SLIDE_H, SLIDE_W } from './GlassSlide'
import { useI18n } from './i18n'
import { loadMyEntry } from './myEntry'
import { SlideZoom } from './SlideZoom'
import { Rich } from './ui/Rich'
import { TopBar } from './ui/TopBar'

const POLL_MS = 3000
// Fixed canvas: just big enough for a 10 x 15 grid of fixed-size slides (150) with ~18px gaps,
// so "Fit" shows them as large as possible without overlapping.
const BOARD_W = 3760
const BOARD_H = 2040
const FREE_W = BOARD_W - SLIDE_W
const FREE_H = BOARD_H - SLIDE_H
const MIN_ZOOM = 0.1
const MAX_ZOOM = 2
// Screen pixels a pointer may wander before a press counts as a drag rather than a click.
const DRAG_THRESHOLD = 5
// Below this width the board defaults to a vertical list of full-width slides.
const NARROW_QUERY = '(max-width: 640px)'
// Rows of the registration grid; used to read the board top-to-bottom, left-to-right in the list.
const GRID_ROWS = 15

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))
const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))
// Reading order of the board: by grid row (from y), then left to right (x).
const readingOrder = (a: Slide, b: Slide) =>
  Math.round(a.y * (GRID_ROWS - 1)) - Math.round(b.y * (GRID_ROWS - 1)) || a.x - b.x
const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => matchMedia(query).matches)
  useEffect(() => {
    const mql = matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])
  return matches
}

interface Drag {
  id: number
  dx: number
  dy: number
  x: number
  y: number
  startX: number
  startY: number
  moved: boolean
}

export function BoardPage() {
  const { t, errorText } = useI18n()
  const boardRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [zoomMode, setZoomMode] = useState<'fit' | number>('fit')
  const isNarrow = useMediaQuery(NARROW_QUERY)
  // null = follow the screen size (list on phones, board elsewhere) until the viewer picks one.
  const [viewChoice, setViewChoice] = useState<'list' | 'board' | null>(null)
  const view = viewChoice ?? (isNarrow ? 'list' : 'board')
  const [query, setQuery] = useState('')
  const [slides, setSlides] = useState<Slide[]>([])
  const [loaded, setLoaded] = useState(false)
  // Glide only for position changes after the first paint, not the initial layout.
  const [animate, setAnimate] = useState(false)
  const [error, setError] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  // The slide this browser registered, which its owner may drag.
  const [mine] = useState(loadMyEntry)
  // Slide shown in the zoom view.
  const [openId, setOpenId] = useState<number | null>(null)

  // Slides being dragged or saved keep their local position when a poll lands.
  const lockedIds = useRef(new Set<number>())
  const drag = useRef<Drag | null>(null)
  // Set when a press turned into a drag, so the click that follows doesn't open the slide.
  const suppressClick = useRef(false)
  const [draggingId, setDraggingId] = useState<number | null>(null)
  // Last-dragged slide sits on top.
  const [zOrder, setZOrder] = useState<Record<number, number>>({})
  const zCounter = useRef(1)

  useLayoutEffect(() => {
    const el = boardRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
    // The board element only exists in board view, so (re)measure when switching to it.
  }, [view])

  useEffect(() => {
    // Logged-in admins (see /admin) can drag every slide.
    getMe().then(
      (me) => setIsAdmin(!!me),
      () => setIsAdmin(false),
    )
  }, [])

  useEffect(() => {
    let timer: number | undefined
    let cancelled = false

    async function poll() {
      try {
        const fresh = await fetchSlides()
        if (cancelled) return
        setSlides((prev) => {
          const local = new Map(prev.map((s) => [s.id, s]))
          return fresh.map((s) => (lockedIds.current.has(s.id) ? (local.get(s.id) ?? s) : s))
        })
        setError('')
      } catch {
        if (!cancelled) setError('connection')
      } finally {
        if (!cancelled) {
          setLoaded(true)
          window.setTimeout(() => !cancelled && setAnimate(true), 100)
          timer = window.setTimeout(poll, POLL_MS)
        }
      }
    }

    poll()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [])

  const fitZoom = size.w ? clampZoom(Math.min(size.w / BOARD_W, size.h / BOARD_H)) : 0
  const zoom = zoomMode === 'fit' ? fitZoom : zoomMode
  const mySlide = mine ? slides.find((s) => s.id === mine.id) : undefined
  const canDrag = (s: Slide) => isAdmin || s.id === mySlide?.id
  const openSlide = slides.find((s) => s.id === openId)
  const listSlides = useMemo(() => {
    const q = normalize(query.trim())
    return [...slides].sort(readingOrder).filter((s) => !q || normalize(s.fullName).includes(q))
  }, [slides, query])

  const getOpenRect = useCallback(
    () => (openId === null ? null : (document.getElementById(`slide-${openId}`)?.getBoundingClientRect() ?? null)),
    [openId],
  )
  const closeZoom = useCallback(() => setOpenId(null), [])

  function showMySlide() {
    if (!mySlide) return
    if (view === 'list') setQuery('')
    else setZoomMode(1)
    requestAnimationFrame(() =>
      document
        .getElementById(`slide-${mySlide.id}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' }),
    )
  }

  function onSlideClick(s: Slide) {
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    setOpenId(s.id)
  }

  // Pointer position in canvas pixels (undoing the zoom).
  function toCanvas(e: PointerEvent) {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom }
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>, slide: Slide) {
    if (!canDrag(slide) || e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = toCanvas(e)
    drag.current = {
      id: slide.id,
      dx: p.x - slide.x * FREE_W,
      dy: p.y - slide.y * FREE_H,
      x: slide.x,
      y: slide.y,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    }
    suppressClick.current = false
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current
    if (!d) return
    if (!d.moved) {
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < DRAG_THRESHOLD) return
      // It's a drag, not a click.
      d.moved = true
      lockedIds.current.add(d.id)
      setDraggingId(d.id)
      setZOrder((z) => ({ ...z, [d.id]: ++zCounter.current }))
    }
    const p = toCanvas(e)
    const x = clamp01((p.x - d.dx) / FREE_W)
    const y = clamp01((p.y - d.dy) / FREE_H)
    d.x = x
    d.y = y
    setSlides((prev) => prev.map((s) => (s.id === d.id ? { ...s, x, y } : s)))
  }

  async function onPointerUp() {
    const d = drag.current
    if (!d) return
    drag.current = null
    // A press without movement is left to the click handler (opens the zoom view).
    if (!d.moved) return
    suppressClick.current = true
    setDraggingId(null)
    try {
      // Owners prove it's their slide with the edit token; admins use their session.
      await moveSlide(d.id, d.x, d.y, d.id === mine?.id ? mine.editToken : undefined)
    } catch (err) {
      setError(t('board.saveFailed', { msg: errorText(err) }))
    } finally {
      lockedIds.current.delete(d.id)
    }
  }

  // 'connection' is re-translated on language change; save failures are stored already translated.
  const errorMessage = error === 'connection' ? t('board.connectionLost') : error

  return (
    <div className="board-page">
      <TopBar>
        <span className="chip">
          {t(slides.length === 1 ? 'board.count_one' : 'board.count_other', { n: slides.length })}
        </span>
        {isAdmin ? (
          <a className="btn btn-secondary btn-sm" href="/admin">
            {t('board.adminPanel')}
          </a>
        ) : mine ? (
          <a className="btn btn-secondary btn-sm" href="/edit">
            {t('board.editMine')}
          </a>
        ) : (
          <>
            <a className="btn btn-ghost btn-sm" href="/login">
              {t('board.signIn')}
            </a>
            <a className="btn btn-primary btn-sm" href="/code">
              {t('board.addSlide')}
            </a>
          </>
        )}
      </TopBar>

      <div className="board-tools">
        {isAdmin ? (
          <span className="chip">{t('board.adminBadge')}</span>
        ) : (
          mySlide && (
            <button type="button" className="chip" onClick={showMySlide} title={t('board.dragHint')}>
              ◎ {t('board.findMine')}
              {view === 'board' && <span className="muted"> · {t('board.dragHint')}</span>}
            </button>
          )
        )}
        {errorMessage && <span className="error">{errorMessage}</span>}
        {view === 'list' && (
          <input
            className="input list-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('board.searchPlaceholder')}
            aria-label={t('board.searchPlaceholder')}
          />
        )}
        {(isNarrow || viewChoice) && (
          <div className="zoom view-toggle" role="group" aria-label={t('board.viewLabel')}>
            <button type="button" aria-pressed={view === 'list'} onClick={() => setViewChoice('list')}>
              ☰ {t('board.viewList')}
            </button>
            <button type="button" aria-pressed={view === 'board'} onClick={() => setViewChoice('board')}>
              ▦ {t('board.viewBoard')}
            </button>
          </div>
        )}
        {view === 'board' && (
          <div className="zoom" role="group" aria-label={t('board.zoomLabel')} style={{ marginLeft: 'auto' }}>
            <button
              type="button"
              aria-label={t('board.zoomOut')}
              title={t('board.zoomOut')}
              onClick={() => setZoomMode(clampZoom(zoom / 1.25))}
            >
              −
            </button>
            <button type="button" aria-pressed={zoomMode === 'fit'} onClick={() => setZoomMode('fit')}>
              {t('board.fit')}
            </button>
            <button type="button" aria-pressed={zoomMode === 1} onClick={() => setZoomMode(1)}>
              100%
            </button>
            <button
              type="button"
              aria-label={t('board.zoomIn')}
              title={t('board.zoomIn')}
              onClick={() => setZoomMode(clampZoom(zoom * 1.25))}
            >
              +
            </button>
          </div>
        )}
      </div>

      {view === 'list' ? (
        <div className="board slide-list-wrap">
          {loaded && slides.length > 0 && listSlides.length === 0 && (
            <p className="list-empty muted">{t('board.noResults')}</p>
          )}
          <ol className="slide-list">
            {listSlides.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  id={`slide-${s.id}`}
                  className={['slide-item', s.id === mySlide?.id && 'mine', openId === s.id && 'is-open']
                    .filter(Boolean)
                    .join(' ')}
                  aria-label={t('board.openSlide', { name: s.fullName })}
                  onClick={() => setOpenId(s.id)}
                >
                  <GlassSlide id={s.id} name={s.fullName} learning={s.learning} />
                </button>
              </li>
            ))}
          </ol>
          {loaded && slides.length === 0 && (
            <div className="board-empty">
              <h2>
                <Rich text={t('board.emptyTitle')} />
              </h2>
              <p>{t('board.emptyText')}</p>
              <a className="btn btn-primary" href="/code">
                {t('board.addSlide')}
              </a>
            </div>
          )}
        </div>
      ) : (
        <div className={`board${animate ? ' animate' : ''}${zoomMode === 'fit' ? ' fit' : ''}`} ref={boardRef}>
          {loaded && slides.length === 0 && (
            <div className="board-empty">
              <h2>
                <Rich text={t('board.emptyTitle')} />
              </h2>
              <p>{t('board.emptyText')}</p>
              <a className="btn btn-primary" href="/code">
                {t('board.addSlide')}
              </a>
            </div>
          )}
          {zoom > 0 && (
            // Sized to the zoomed canvas so the viewport scrolls over it; centred when smaller.
            <div
              style={{
                position: 'relative',
                width: BOARD_W * zoom,
                height: BOARD_H * zoom,
                // In Fit mode on tall screens (phones), centre the canvas vertically too.
                margin: `${zoomMode === 'fit' ? Math.max(0, (size.h - BOARD_H * zoom) / 2) : 0}px auto 0`,
              }}
            >
              <div
                className="board-canvas"
                ref={canvasRef}
                style={{ width: BOARD_W, height: BOARD_H, transform: `scale(${zoom})` }}
              >
                {slides.map((s) => (
                  <div
                    key={s.id}
                    id={`slide-${s.id}`}
                    role="button"
                    tabIndex={0}
                    aria-label={t('board.openSlide', { name: s.fullName })}
                    className={[
                      'slide-pos',
                      canDrag(s) && 'can-drag',
                      s.id === mySlide?.id && 'mine',
                      draggingId === s.id && 'dragging',
                      openId === s.id && 'is-open',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    style={{
                      width: SLIDE_W,
                      height: SLIDE_H,
                      transform: `translate(${s.x * FREE_W}px, ${s.y * FREE_H}px)`,
                      zIndex: zOrder[s.id] ?? (s.id === mySlide?.id ? 2 : 1),
                    }}
                    onClick={() => onSlideClick(s)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setOpenId(s.id)
                      }
                    }}
                    onPointerDown={(e) => onPointerDown(e, s)}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                  >
                    <GlassSlide id={s.id} name={s.fullName} learning={s.learning} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {openSlide && <SlideZoom key={openSlide.id} slide={openSlide} getRect={getOpenRect} onClosed={closeZoom} />}
    </div>
  )
}
