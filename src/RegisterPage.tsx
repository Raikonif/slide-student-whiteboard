import { Fragment, useEffect, useState, type FormEvent, type MouseEvent, type ReactNode } from 'react'
import { ApiError, checkCode, participantLogin, register, updateParticipant, type Details } from './api'
import { GlassSlide } from './GlassSlide'
import { useI18n } from './i18n'
import { loadMyEntry, saveMyEntry, type MyEntry } from './myEntry'
import { TopBar } from './ui/TopBar'
import './register.css'

// Participant flow, all on one page:
//   /code    step 1 — access code (also accepts ?code= from a link / QR)
//   /details step 2 — name, email, what you learned
//   /login   sign back in with email + current code
//   /edit    edit your own slide (needs an entry stored in this browser)

type Route = 'code' | 'details' | 'login' | 'edit'
const PATHS: Record<Route, string> = { code: '/code', details: '/details', login: '/login', edit: '/edit' }

function routeFromPath(): Route {
  const p = location.pathname.replace(/\/+$/, '')
  return (Object.keys(PATHS) as Route[]).find((r) => PATHS[r] === p) ?? 'code'
}

// ---------- Access code kept for this tab only ----------

const CODE_KEY = 'slides-code'

function loadCode() {
  try {
    return sessionStorage.getItem(CODE_KEY) ?? ''
  } catch {
    return ''
  }
}

function saveCode(code: string) {
  try {
    if (code) sessionStorage.setItem(CODE_KEY, code)
    else sessionStorage.removeItem(CODE_KEY)
  } catch {
    // Storage unavailable — the code still lives in component state.
  }
}

// "Text with *one* accent" -> Text with <em>one</em> accent (for headings).
function accent(text: string): ReactNode {
  return text.split('*').map((part, i) => (i % 2 ? <em key={i}>{part}</em> : <Fragment key={i}>{part}</Fragment>))
}

const trimDetails = (d: Details): Details => ({
  fullName: d.fullName.trim(),
  email: d.email.trim(),
  learning: d.learning.trim(),
})

const EMPTY_DETAILS: Details = { fullName: '', email: '', learning: '' }

export function RegisterPage() {
  const { t } = useI18n()
  const [path, setPath] = useState<Route>(routeFromPath)
  const [code, setCode] = useState(loadCode)
  const [entry, setEntry] = useState(loadMyEntry)
  // Messages carried over when we bounce someone to another step.
  const [codeNotice, setCodeNotice] = useState('')
  const [loginNotice, setLoginNotice] = useState('')

  // Guards: /details needs a validated code, /edit needs a stored entry.
  const route: Route = path === 'details' && !code ? 'code' : path === 'edit' && !entry ? 'login' : path

  // Keep the URL in line with what's shown (`path` may stay stale; `route` is what renders).
  useEffect(() => {
    if (route !== path) history.replaceState(null, '', PATHS[route] + (route === 'code' ? location.search : ''))
  }, [route, path])

  useEffect(() => {
    const onPop = () => setPath(routeFromPath())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [route])

  function go(next: Route, replace = false) {
    if (replace) history.replaceState(null, '', PATHS[next])
    else history.pushState(null, '', PATHS[next])
    setPath(next)
  }

  function onCodeAccepted(valid: string) {
    saveCode(valid)
    setCode(valid)
    setCodeNotice('')
    // Drop ?code= so going Back shows step 1 instead of re-validating the link.
    history.replaceState(null, '', PATHS.code)
    go('details')
  }

  // The code was rotated / registration closed while filling in details.
  function onCodeRejected(message: string) {
    saveCode('')
    setCode('')
    setCodeNotice(message)
    go('code', true)
  }

  function onSignedIn(next: MyEntry) {
    saveMyEntry(next)
    setEntry(next)
    setLoginNotice('')
    go('edit')
  }

  function onEntryGone(message: string) {
    saveMyEntry(null)
    setEntry(null)
    setLoginNotice(message)
    go('login', true)
  }

  function signOut() {
    saveMyEntry(null)
    setEntry(null)
    go('code')
  }

  const link = (to: Route) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    setCodeNotice('')
    setLoginNotice('')
    go(to)
  }

  let content: ReactNode
  if (route === 'code') {
    content = (
      <CodeStep
        key={codeNotice}
        initialError={codeNotice}
        entry={entry}
        onAccepted={onCodeAccepted}
        onEdit={link('edit')}
        onLogin={link('login')}
      />
    )
  } else if (route === 'details') {
    content = <DetailsStep code={code} onRejected={onCodeRejected} onLogin={link('login')} />
  } else if (route === 'login') {
    content = (
      <LoginStep key={loginNotice} initialError={loginNotice} initialCode={code} onSignedIn={onSignedIn} onRegister={link('code')} />
    )
  } else {
    content = <EditStep key={entry!.id} entry={entry!} onGone={onEntryGone} onSignOut={signOut} />
  }

  return (
    <div className="reg-page">
      <TopBar>
        <a className="btn btn-ghost btn-sm" href="/">
          {t('common.viewBoard')}
        </a>
      </TopBar>
      <main className="reg-main">{content}</main>
    </div>
  )
}

// ---------- Pieces ----------

function Steps({ current }: { current: 1 | 2 }) {
  const { t } = useI18n()
  return (
    <div className="reg-steps">
      <div className="reg-steps-bar" aria-hidden="true">
        <span className="is-on" />
        <span className={current === 2 ? 'is-on' : ''} />
      </div>
      <p className="eyebrow">{t('register.stepOf', { n: current, total: 2 })}</p>
    </div>
  )
}

function Heading({ title, intro, children }: { title: string; intro?: string; children?: ReactNode }) {
  return (
    <header className="reg-head">
      {children}
      <h1>{accent(title)}</h1>
      {intro && <p className="muted">{intro}</p>}
    </header>
  )
}

function Preview({ id, details }: { id: number; details: Details }) {
  const { t } = useI18n()
  const name = details.fullName.trim()
  if (!name) return null
  return (
    <figure className="reg-preview">
      <figcaption className="eyebrow">{t('register.preview')}</figcaption>
      <div className="reg-preview-slide">
        <GlassSlide id={id} name={name} learning={details.learning.trim()} />
      </div>
    </figure>
  )
}

const NAME_MAX = 80
const EMAIL_MAX = 120
const LEARNING_MAX = 280

// Shared by /details and /edit. Limits mirror the API's validation.
function DetailsFields({
  value,
  onChange,
  autoFocus,
}: {
  value: Details
  onChange: (next: Details) => void
  autoFocus?: boolean
}) {
  const { t } = useI18n()
  const set = (key: keyof Details) => (e: { target: { value: string } }) => onChange({ ...value, [key]: e.target.value })

  return (
    <>
      <div className="field">
        <label htmlFor="reg-name">{t('register.fullName')}</label>
        <input
          id="reg-name"
          className="input"
          value={value.fullName}
          onChange={set('fullName')}
          maxLength={NAME_MAX}
          autoComplete="name"
          placeholder={t('register.fullNamePlaceholder')}
          autoFocus={autoFocus}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="reg-email">{t('register.email')}</label>
        <input
          id="reg-email"
          className="input"
          type="email"
          value={value.email}
          onChange={set('email')}
          maxLength={EMAIL_MAX}
          autoComplete="email"
          inputMode="email"
          aria-describedby="reg-email-hint"
          required
        />
        <p id="reg-email-hint" className="field-hint">
          {t('register.emailHint')}
        </p>
      </div>
      <div className="field">
        <label htmlFor="reg-learning">{t('register.learning')}</label>
        <textarea
          id="reg-learning"
          className="textarea"
          value={value.learning}
          onChange={set('learning')}
          maxLength={LEARNING_MAX}
          rows={4}
          placeholder={t('register.learningPlaceholder')}
          aria-describedby="reg-learning-count"
          required
        />
        <span id="reg-learning-count" className="char-count" aria-live="polite">
          {value.learning.length}/{LEARNING_MAX}
        </span>
      </div>
    </>
  )
}

// ---------- /code ----------

function CodeStep({
  initialError,
  entry,
  onAccepted,
  onEdit,
  onLogin,
}: {
  initialError: string
  entry: MyEntry | null
  onAccepted: (code: string) => void
  onEdit: (e: MouseEvent<HTMLAnchorElement>) => void
  onLogin: (e: MouseEvent<HTMLAnchorElement>) => void
}) {
  const { t, errorText } = useI18n()
  // Admins may share links / QR codes like /code?code=AB12CD34
  const [linkCode] = useState(() => new URLSearchParams(location.search).get('code')?.trim().toUpperCase() ?? '')
  const [code, setCode] = useState(linkCode)
  const [sending, setSending] = useState(Boolean(linkCode && !initialError))
  const [error, setError] = useState(initialError)

  async function submit(value: string) {
    if (!value) return
    setSending(true)
    setError('')
    try {
      await checkCode(value)
      onAccepted(value)
    } catch (err) {
      setError(errorText(err))
      setSending(false)
    }
  }

  // A code from a link/QR is checked straight away.
  useEffect(() => {
    if (!linkCode || initialError) return
    let cancelled = false
    checkCode(linkCode).then(
      () => !cancelled && onAccepted(linkCode),
      (err) => {
        if (cancelled) return
        setError(errorText(err))
        setSending(false)
      },
    )
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once for the link code
  }, [])

  return (
    <>
      {entry && (
        <section className="card reg-existing" aria-labelledby="reg-existing-title">
          <div className="reg-existing-slide" aria-hidden="true">
            <GlassSlide id={entry.id} name={entry.fullName} learning="" />
          </div>
          <div className="reg-existing-text">
            <h2 id="reg-existing-title">{accent(t('register.existingTitle'))}</h2>
            <p className="muted small">{t('register.existingBody')}</p>
          </div>
          <div className="reg-actions">
            <a className="btn btn-primary btn-sm" href={PATHS.edit} onClick={onEdit}>
              {t('register.editMine')}
            </a>
            <a className="btn btn-secondary btn-sm" href="/">
              {t('common.viewBoard')}
            </a>
          </div>
        </section>
      )}

      <Heading title={t('register.codeTitle')} intro={t('register.codeIntro')}>
        <Steps current={1} />
      </Heading>

      <form
        className="card reg-form"
        onSubmit={(e: FormEvent) => {
          e.preventDefault()
          submit(code.trim().toUpperCase())
        }}
      >
        <div className="field">
          <label htmlFor="reg-code">{t('register.codeLabel')}</label>
          <input
            id="reg-code"
            className="input reg-code-input"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="••••••"
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            autoFocus={!entry}
            maxLength={32}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'reg-code-error' : undefined}
            required
          />
        </div>
        {error && (
          <p id="reg-code-error" className="notice notice-error" role="alert">
            {error}
            {initialError && <> {t('register.askOrganizer')}</>}
          </p>
        )}
        <button type="submit" className="btn btn-primary btn-block" disabled={sending}>
          {sending ? t('register.checking') : t('register.continue')}
        </button>
      </form>

      <p className="reg-alt">
        {t('register.haveSlide')}{' '}
        <a href={PATHS.login} onClick={onLogin}>
          {t('register.loginToEdit')}
        </a>
      </p>
    </>
  )
}

// ---------- /details ----------

function DetailsStep({
  code,
  onRejected,
  onLogin,
}: {
  code: string
  onRejected: (message: string) => void
  onLogin: (e: MouseEvent<HTMLAnchorElement>) => void
}) {
  const { t, errorText } = useI18n()
  const [details, setDetails] = useState(EMPTY_DETAILS)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<{ text: string; emailTaken: boolean } | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSending(true)
    setError(null)
    const clean = trimDetails(details)
    try {
      const { id, editToken } = await register(code, clean)
      saveMyEntry({ id, editToken, ...clean })
      saveCode('')
      location.assign('/')
    } catch (err) {
      setSending(false)
      if (
        err instanceof ApiError &&
        (err.status === 403 || err.status === 409) &&
        (err.code === 'invalid_code' || err.code === 'registration_closed')
      ) {
        return onRejected(errorText(err))
      }
      setError({ text: errorText(err), emailTaken: err instanceof ApiError && err.code === 'email_taken' })
    }
  }

  return (
    <>
      <Heading title={t('register.detailsTitle')} intro={t('register.detailsIntro')}>
        <Steps current={2} />
      </Heading>

      <Preview id={0} details={details} />

      <form className="card reg-form" onSubmit={onSubmit}>
        <DetailsFields value={details} onChange={setDetails} autoFocus />
        {error && (
          <p className="notice notice-error" role="alert">
            {error.text}
            {error.emailTaken && (
              <>
                {' '}
                <a href={PATHS.login} onClick={onLogin}>
                  {t('register.goToLogin')}
                </a>
              </>
            )}
          </p>
        )}
        <button type="submit" className="btn btn-primary btn-block" disabled={sending}>
          {sending ? t('register.saving') : t('register.submit')}
        </button>
      </form>

      <p className="reg-alt">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => history.back()}>
          ← {t('common.back')}
        </button>
      </p>
    </>
  )
}

// ---------- /login ----------

function LoginStep({
  initialError,
  initialCode,
  onSignedIn,
  onRegister,
}: {
  initialError: string
  initialCode: string
  onSignedIn: (entry: MyEntry) => void
  onRegister: (e: MouseEvent<HTMLAnchorElement>) => void
}) {
  const { t, errorText } = useI18n()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState(initialCode)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(initialError)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSending(true)
    setError('')
    try {
      const res = await participantLogin(email.trim(), code.trim().toUpperCase())
      onSignedIn({ id: res.id, editToken: res.editToken, fullName: res.fullName, email: res.email, learning: res.learning })
    } catch (err) {
      setError(errorText(err))
      setSending(false)
    }
  }

  return (
    <>
      <Heading title={t('register.loginTitle')} intro={t('register.loginIntro')} />

      <form className="card reg-form" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="login-email">{t('register.email')}</label>
          <input
            id="login-email"
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={EMAIL_MAX}
            autoComplete="email"
            inputMode="email"
            autoFocus
            required
          />
        </div>
        <div className="field">
          <label htmlFor="login-code">{t('register.codeLabel')}</label>
          <input
            id="login-code"
            className="input reg-code-input reg-code-input-sm"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            maxLength={32}
            required
          />
          <p className="field-hint">{t('register.loginCodeHint')}</p>
        </div>
        {error && (
          <p className="notice notice-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary btn-block" disabled={sending}>
          {sending ? t('register.signingIn') : t('register.loginSubmit')}
        </button>
      </form>

      <p className="reg-alt">
        {t('register.noSlide')}{' '}
        <a href={PATHS.code} onClick={onRegister}>
          {t('register.registerLink')}
        </a>
      </p>
    </>
  )
}

// ---------- /edit ----------

function EditStep({
  entry,
  onGone,
  onSignOut,
}: {
  entry: MyEntry
  onGone: (message: string) => void
  onSignOut: () => void
}) {
  const { t, errorText } = useI18n()
  const [details, setDetails] = useState<Details>(() => ({
    fullName: entry.fullName,
    email: entry.email,
    learning: entry.learning,
  }))
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSending(true)
    setError('')
    const clean = trimDetails(details)
    try {
      await updateParticipant(entry.editToken, clean)
      saveMyEntry({ ...entry, ...clean })
      location.assign('/')
    } catch (err) {
      setSending(false)
      // The slide was removed by an admin.
      if (err instanceof ApiError && err.status === 404) return onGone(errorText(err))
      setError(errorText(err))
    }
  }

  return (
    <>
      <Heading title={t('register.editTitle')} intro={t('register.editIntro')} />

      <Preview id={entry.id} details={details} />

      <form className="card reg-form" onSubmit={onSubmit}>
        <DetailsFields value={details} onChange={setDetails} />
        {error && (
          <p className="notice notice-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary btn-block" disabled={sending}>
          {sending ? t('register.saving') : t('register.saveChanges')}
        </button>
      </form>

      <p className="reg-tip small">{t('register.dragTip')}</p>

      <p className="reg-alt">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onSignOut}>
          {t('register.signOut')}
        </button>
      </p>
    </>
  )
}
