export interface Env {
  DB: D1Database
}

const SESSION_COOKIE = 'admin_session'
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000
// Cloudflare Workers caps PBKDF2 at 100k iterations.
const PBKDF2_ITERATIONS = 100_000

const enc = new TextEncoder()
const toB64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf)))
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

export function json(data: unknown, status = 200, headers: HeadersInit = {}) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', ...headers } })
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  const body = await request.json().catch(() => null)
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
}

export function randomToken(bytes = 32) {
  return [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function sha256(value: string) {
  return toB64(await crypto.subtle.digest('SHA-256', enc.encode(value)))
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256))
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS)
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toB64(salt)}$${toB64(hash)}`
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, iter, salt, expected] = stored.split('$')
  if (scheme !== 'pbkdf2' || !iter || !salt || !expected) return false
  const actual = await pbkdf2(password, fromB64(salt), Number(iter))
  const want = fromB64(expected)
  if (actual.length !== want.length) return false
  let diff = 0
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ want[i]
  return diff === 0
}

function readCookie(request: Request, name: string) {
  const header = request.headers.get('Cookie') ?? ''
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return v.join('=')
  }
  return null
}

function cookie(request: Request, value: string, maxAgeSeconds: number) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : ''
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSeconds}${secure}`
}

export async function createSession(env: Env, request: Request, adminId: number) {
  const token = randomToken()
  await env.DB.batch([
    env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?1').bind(Date.now()),
    env.DB.prepare('INSERT INTO sessions (token_hash, admin_id, expires_at) VALUES (?1, ?2, ?3)').bind(
      await sha256(token),
      adminId,
      Date.now() + SESSION_TTL_MS,
    ),
  ])
  return cookie(request, token, SESSION_TTL_MS / 1000)
}

export async function destroySession(env: Env, request: Request) {
  const token = readCookie(request, SESSION_COOKIE)
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?1').bind(await sha256(token)).run()
  return cookie(request, '', 0)
}

export interface Admin {
  id: number
  email: string
}

export async function getAdmin(env: Env, request: Request): Promise<Admin | null> {
  const token = readCookie(request, SESSION_COOKIE)
  if (!token) return null
  return env.DB.prepare(
    `SELECT a.id, a.email FROM sessions s JOIN admins a ON a.id = s.admin_id
      WHERE s.token_hash = ?1 AND s.expires_at > ?2`,
  )
    .bind(await sha256(token), Date.now())
    .first<Admin>()
}

// Wraps a handler so it only runs for a logged-in admin.
export function adminOnly<P extends string = string>(
  handler: (ctx: EventContext<Env, P, Record<string, unknown>>, admin: Admin) => Promise<Response>,
): PagesFunction<Env, P> {
  return async (ctx) => {
    const admin = await getAdmin(ctx.env, ctx.request)
    if (!admin) return json({ error: 'Not logged in.', code: 'not_logged_in' }, 401)
    return handler(ctx, admin)
  }
}
