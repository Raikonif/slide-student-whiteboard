import { createSession, json, readJson, verifyPassword, type Env } from '../../../server/auth'
import { fail } from '../../../server/errors'

const WINDOW_MS = 15 * 60 * 1000
const MAX_FAILURES = 10

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
  const since = Date.now() - WINDOW_MS
  const failures =
    (await env.DB.prepare('SELECT COUNT(*) AS n FROM login_attempts WHERE ip = ?1 AND at > ?2')
      .bind(ip, since)
      .first<number>('n')) ?? 0
  if (failures >= MAX_FAILURES) return fail('too_many_attempts', 429)

  const body = await readJson(request)
  const email = String(body.email ?? '').trim().toLowerCase()
  const password = String(body.password ?? '')

  const admin = await env.DB.prepare('SELECT id, email, password_hash FROM admins WHERE email = ?1')
    .bind(email)
    .first<{ id: number; email: string; password_hash: string }>()

  if (!admin || !(await verifyPassword(password, admin.password_hash))) {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM login_attempts WHERE at < ?1').bind(since),
      env.DB.prepare('INSERT INTO login_attempts (ip, at) VALUES (?1, ?2)').bind(ip, Date.now()),
    ])
    return fail('wrong_credentials', 401)
  }

  await env.DB.prepare('DELETE FROM login_attempts WHERE ip = ?1').bind(ip).run()
  return json({ email: admin.email }, 200, { 'Set-Cookie': await createSession(env, request, admin.id) })
}
