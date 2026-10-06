import type { Env } from './auth'

// No 0/O/1/I/L so codes are easy to read aloud and type.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const LENGTH = 8

export function generateCode() {
  let code = ''
  while (code.length < LENGTH) {
    const byte = crypto.getRandomValues(new Uint8Array(1))[0]
    // Rejection sampling keeps every character equally likely.
    if (byte < 256 - (256 % ALPHABET.length)) code += ALPHABET[byte % ALPHABET.length]
  }
  return code
}

export async function getAccessCode(env: Env) {
  return env.DB.prepare("SELECT value FROM settings WHERE key = 'access_code'").first<string>('value')
}

// Replaces the active code; the previous one stops working immediately.
export async function rotateAccessCode(env: Env) {
  const code = generateCode()
  await env.DB.prepare(
    "INSERT INTO settings (key, value) VALUES ('access_code', ?1) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  )
    .bind(code)
    .run()
  return code
}

// Checks a submitted code against the active one. Returns an error code + status, or null if valid.
export async function checkAccessCode(env: Env, submitted: unknown) {
  const code = String(submitted ?? '').trim().toUpperCase()
  const active = await getAccessCode(env)
  if (!active) return { code: 'registration_closed' as const, status: 409 }
  if (!code || code !== active) return { code: 'invalid_code' as const, status: 403 }
  return null
}
