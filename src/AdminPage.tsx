import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  ApiError,
  changePassword,
  deleteSlide,
  fetchParticipants,
  generateAccessCode,
  getAccessCode,
  getMe,
  login,
  logout,
  type Participant,
} from './api'
import { useI18n } from './i18n'
import { TopBar } from './ui/TopBar'
import './admin.css'

const CONFIRM_MS = 4000
const MIN_PASSWORD = 10

// Messages are stored untranslated (an i18n key or the raw error) so they follow language switches.
type Msg = { key: string; vars?: Record<string, string | number> } | { err: unknown }

function useMsgText() {
  const { t, errorText } = useI18n()
  return (m: Msg) => ('err' in m ? errorText(m.err) : t(m.key, m.vars))
}

// Two-click inline confirmation: arm(key) on first click, armed === key on the second.
// Disarms itself after CONFIRM_MS.
function useConfirm<K>() {
  const [armed, setArmed] = useState<K | null>(null)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const arm = useCallback((key: K | null) => {
    window.clearTimeout(timer.current)
    setArmed(key)
    if (key !== null) timer.current = window.setTimeout(() => setArmed(null), CONFIRM_MS)
  }, [])
  return [armed, arm] as const
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function AdminPage() {
  const { t } = useI18n()
  const msgText = useMsgText()
  // undefined = still checking the session
  const [me, setMe] = useState<{ email: string } | null | undefined>(undefined)
  const [error, setError] = useState<Msg | null>(null)

  useEffect(() => {
    getMe().then(setMe, (err) => {
      setError({ err })
      setMe(null)
    })
  }, [])

  async function onLogout() {
    try {
      await logout()
    } catch {
      // Session is dropped client-side regardless.
    }
    setMe(null)
  }

  // Any 401 from an admin call means the session expired.
  const onAuthError = useCallback((err: unknown) => {
    if (err instanceof ApiError && err.status === 401) {
      setMe(null)
      return true
    }
    return false
  }, [])

  if (me === undefined) {
    return (
      <div className="admin-shell">
        <TopBar />
        <p className="muted admin-loading">{t('common.loading')}</p>
      </div>
    )
  }

  if (!me) return <LoginForm initialError={error ? msgText(error) : ''} onLogin={setMe} />

  return (
    <div className="admin-shell">
      <TopBar>
        <span className="chip admin-email" title={t('admin.signedInAs', { email: me.email })}>
          {me.email}
        </span>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onLogout}>
          {t('admin.logout')}
        </button>
      </TopBar>

      <main className="admin">
        <header className="admin-hero">
          <div className="admin-hero-text">
            <p className="eyebrow">{t('admin.eyebrow')}</p>
            <h1>
              {t('admin.titleLead')} <em>{t('admin.titleAccent')}</em>
            </h1>
            <p className="muted">{t('admin.intro')}</p>
          </div>
          <a className="btn btn-secondary admin-board-link" href="/">
            {t('admin.openBoard')}
            <span aria-hidden="true">→</span>
          </a>
        </header>

        <div className="admin-grid">
          <div className="admin-side">
            <CodeCard onAuthError={onAuthError} />
            <PasswordCard onAuthError={onAuthError} />
          </div>
          <ParticipantsCard onAuthError={onAuthError} />
        </div>
      </main>
    </div>
  )
}

function LoginForm({
  initialError,
  onLogin,
}: {
  initialError: string
  onLogin: (me: { email: string }) => void
}) {
  const { t, errorText } = useI18n()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<unknown>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSending(true)
    setError(null)
    try {
      onLogin(await login(email.trim(), password))
    } catch (err) {
      setError(err)
      setSending(false)
    }
  }

  const errorMsg = error ? errorText(error) : initialError

  return (
    <div className="admin-shell">
      <TopBar />
      <main className="admin-login">
        <form className="card admin-login-card" onSubmit={onSubmit}>
          <div className="admin-login-head">
            <p className="eyebrow">{t('admin.loginEyebrow')}</p>
            <h1>
              {t('admin.loginLead')} <em>{t('admin.loginAccent')}</em>
            </h1>
            <p className="muted">{t('admin.loginIntro')}</p>
          </div>
          <div className="field">
            <label htmlFor="admin-email">{t('admin.email')}</label>
            <input
              id="admin-email"
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="admin-password">{t('admin.password')}</label>
            <input
              id="admin-password"
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          {errorMsg && (
            <p className="notice notice-error" role="alert">
              {errorMsg}
            </p>
          )}
          <button type="submit" className="btn btn-primary btn-block" disabled={sending}>
            {sending ? t('admin.loggingIn') : t('admin.loginSubmit')}
          </button>
          <a className="admin-login-back small" href="/">
            {t('common.viewBoard')}
          </a>
        </form>
      </main>
    </div>
  )
}

type AuthErrorHandler = (err: unknown) => boolean

function CodeCard({ onAuthError }: { onAuthError: AuthErrorHandler }) {
  const { t } = useI18n()
  const msgText = useMsgText()
  // undefined = loading, null = no code yet
  const [code, setCode] = useState<string | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<Msg | null>(null)
  const [flash, setFlash] = useState<Msg | null>(null)
  const [armed, arm] = useConfirm<'generate'>()

  useEffect(() => {
    getAccessCode().then(setCode, (err) => {
      if (!onAuthError(err)) setError({ err })
    })
  }, [onAuthError])

  async function onGenerate() {
    if (code && armed !== 'generate') return arm('generate')
    arm(null)
    setBusy(true)
    setError(null)
    try {
      setCode(await generateAccessCode())
      setFlash({ key: 'admin.generated' })
    } catch (err) {
      if (!onAuthError(err)) setError({ err })
    } finally {
      setBusy(false)
    }
  }

  async function onCopy(text: string, okKey: string) {
    setFlash({ key: (await copyText(text)) ? okKey : 'admin.copyFailed' })
  }

  const link = code ? `${location.origin}/code?code=${encodeURIComponent(code)}` : ''

  return (
    <section className="card admin-card code-card" aria-labelledby="code-title">
      <h2 id="code-title" className="admin-card-title">
        {t('admin.codeTitle')}
      </h2>

      <div className={`code-label${code ? '' : ' is-empty'}`}>
        <span className="code-label-caption">{t('admin.codeLabel')}</span>
        {code === undefined && !error ? (
          <p className="muted">{t('common.loading')}</p>
        ) : code ? (
          <p key={code} className="code-value" aria-live="polite">
            {code}
          </p>
        ) : (
          <p className="muted code-empty">{t('admin.noCode')}</p>
        )}
      </div>

      <div className="code-actions">
        <button
          type="button"
          className={`btn btn-block ${armed === 'generate' ? 'btn-danger' : 'btn-primary'}`}
          onClick={onGenerate}
          disabled={busy || code === undefined}
        >
          {busy
            ? t('admin.generating')
            : armed === 'generate'
              ? t('admin.confirmGenerate')
              : code
                ? t('admin.generate')
                : t('admin.generateFirst')}
        </button>
        {code && (
          <div className="code-copy">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => onCopy(code, 'admin.codeCopied')}>
              {t('admin.copyCode')}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => onCopy(link, 'admin.linkCopied')}>
              {t('admin.copyLink')}
            </button>
          </div>
        )}
      </div>

      {error && <p className="notice notice-error">{msgText(error)}</p>}
      {flash && !error && (
        <p className="notice notice-success" role="status">
          {msgText(flash)}
        </p>
      )}
      <p className="muted small">{t('admin.codeHint')}</p>
    </section>
  )
}

function ParticipantsCard({ onAuthError }: { onAuthError: AuthErrorHandler }) {
  const { t, lang } = useI18n()
  const msgText = useMsgText()
  const [list, setList] = useState<Participant[] | null>(null)
  const [error, setError] = useState<Msg | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [armed, arm] = useConfirm<number>()

  const load = useCallback(
    () =>
      fetchParticipants().then(
        (rows) => {
          setList([...rows].sort((a, b) => b.createdAt - a.createdAt))
          setError(null)
        },
        (err) => {
          if (!onAuthError(err)) setError({ err })
        },
      ),
    [onAuthError],
  )

  useEffect(() => {
    void load()
  }, [load])

  async function onDelete(id: number) {
    if (armed !== id) return arm(id)
    arm(null)
    setDeleting(id)
    try {
      await deleteSlide(id)
    } catch (err) {
      if (!onAuthError(err)) setError({ err })
    } finally {
      setDeleting(null)
    }
    await load()
  }

  const q = query.trim().toLowerCase()
  const shown = useMemo(
    () =>
      !list || !q
        ? list
        : list.filter((p) => p.fullName.toLowerCase().includes(q) || (p.email ?? '').toLowerCase().includes(q)),
    [list, q],
  )
  const locale = lang === 'es' ? 'es' : 'en'

  return (
    <section className="card admin-card participants-card" aria-labelledby="participants-title">
      <div className="participants-head">
        <h2 id="participants-title" className="admin-card-title">
          {t('admin.participantsTitle')}
        </h2>
        {list && (
          <span className="chip">
            {list.length === 1 ? t('admin.participantsCountOne') : t('admin.participantsCount', { n: list.length })}
          </span>
        )}
        {list && list.length > 0 && (
          <input
            className="input participants-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('admin.searchPlaceholder')}
            aria-label={t('admin.search')}
          />
        )}
      </div>

      {error && <p className="notice notice-error">{msgText(error)}</p>}
      {!list || !shown ? (
        !error && <p className="muted">{t('common.loading')}</p>
      ) : list.length === 0 ? (
        <p className="participants-empty muted">{t('admin.noParticipants')}</p>
      ) : shown.length === 0 ? (
        <p className="participants-empty muted">{t('admin.noMatches', { q: query.trim() })}</p>
      ) : (
        <div className="table-scroll">
          <table className="participants">
            <thead>
              <tr>
                <th scope="col">{t('admin.colName')}</th>
                <th scope="col">{t('admin.colEmail')}</th>
                <th scope="col">{t('admin.colLearning')}</th>
                <th scope="col">{t('admin.colRegistered')}</th>
                <th scope="col">
                  <span className="admin-sr-only">{t('admin.colActions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.id}>
                  <td className="cell-name">{p.fullName}</td>
                  <td className="cell-email">{p.email || <span className="muted">—</span>}</td>
                  <td className="cell-learning" title={p.learning}>
                    {p.learning || <span className="muted">—</span>}
                  </td>
                  <td className="cell-date">{new Date(p.createdAt).toLocaleString(locale)}</td>
                  <td className="cell-action">
                    <button
                      type="button"
                      className={`btn btn-sm ${armed === p.id ? 'btn-danger' : 'btn-ghost'}`}
                      onClick={() => onDelete(p.id)}
                      disabled={deleting === p.id}
                      aria-label={armed === p.id ? undefined : t('admin.deleteLabel', { name: p.fullName })}
                    >
                      {deleting === p.id
                        ? t('admin.deleting')
                        : armed === p.id
                          ? t('admin.confirmDelete')
                          : t('admin.delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function PasswordCard({ onAuthError }: { onAuthError: AuthErrorHandler }) {
  const { t } = useI18n()
  const msgText = useMsgText()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<Msg | null>(null)
  const [done, setDone] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setDone(false)
    if (next.length < MIN_PASSWORD) return setError({ key: 'admin.passwordTooShort', vars: { n: MIN_PASSWORD } })
    if (next !== confirm) return setError({ key: 'admin.passwordMismatch' })
    setSending(true)
    try {
      await changePassword(current, next)
      setCurrent('')
      setNext('')
      setConfirm('')
      setDone(true)
    } catch (err) {
      // 401 here means "current password wrong" (code wrong_current_password), not an expired session,
      // so it is shown inline instead of going through onAuthError.
      if ((err instanceof ApiError && err.status === 401) || !onAuthError(err)) setError({ err })
    } finally {
      setSending(false)
    }
  }

  // Collapsed by default: it's rarely needed and the access code is the main task here.
  return (
    <details className="card admin-card password-card">
      <summary>
        <h2 className="admin-card-title">{t('admin.passwordTitle')}</h2>
        <span className="password-chevron" aria-hidden="true" />
      </summary>
      <form className="admin-form" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="pw-current">{t('admin.currentPassword')}</label>
          <input
            id="pw-current"
            className="input"
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="pw-next">{t('admin.newPassword')}</label>
          <input
            id="pw-next"
            className="input"
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
            minLength={MIN_PASSWORD}
            aria-describedby="pw-next-hint"
            required
          />
          <span id="pw-next-hint" className="field-hint">
            {t('admin.newPasswordHint', { n: MIN_PASSWORD })}
          </span>
        </div>
        <div className="field">
          <label htmlFor="pw-confirm">{t('admin.confirmPassword')}</label>
          <input
            id="pw-confirm"
            className="input"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>
        {error && (
          <p className="notice notice-error" role="alert">
            {msgText(error)}
          </p>
        )}
        {done && (
          <p className="notice notice-success" role="status">
            {t('admin.passwordChanged')}
          </p>
        )}
        <button type="submit" className="btn btn-primary btn-block" disabled={sending}>
          {sending ? t('admin.saving') : t('admin.savePassword')}
        </button>
      </form>
    </details>
  )
}
