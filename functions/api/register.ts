import { checkAccessCode } from '../../server/accessCode'
import { json, randomToken, readJson, type Env } from '../../server/auth'
import { fail } from '../../server/errors'
import { isUniqueViolation, validateDetails } from '../../server/participant'

const COLS = 10
const ROWS = 15

// Registers a new slide using the currently active access code.
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = await readJson(request)
  const invalid = await checkAccessCode(env, body.code)
  if (invalid) return fail(invalid.code, invalid.status)

  const details = validateDetails(body)
  if ('error' in details) return fail(details.error, 400)

  const taken = await env.DB.prepare('SELECT 1 FROM participants WHERE email = ?1').bind(details.email).first()
  if (taken) return fail('email_taken', 409)

  // New slides fill a 10 x 15 grid in arrival order (enough for 150).
  // A counter that never goes down, so deleting a slide doesn't make the next one overlap.
  const slot =
    (await env.DB.prepare(
      `INSERT INTO settings (key, value) VALUES ('next_slot', '1')
       ON CONFLICT(key) DO UPDATE SET value = CAST(value AS INTEGER) + 1
       RETURNING CAST(value AS INTEGER) - 1 AS slot`,
    ).first<number>('slot')) ?? 0
  // Jitter stays below half the ~18px gap between slides (on a 3400 x 1920 free area), so neighbours never touch.
  const jitter = () => (Math.random() - 0.5) * 0.004
  // Past 150, each extra lap is shifted by half a cell instead of stacking exactly on top.
  const lap = Math.floor(slot / (COLS * ROWS))
  const shift = (lap % 2) * 0.5
  const x = Math.min(1, Math.max(0, ((slot % COLS) + shift) / (COLS - 1) + jitter()))
  const y = Math.min(1, Math.max(0, ((Math.floor(slot / COLS) % ROWS) + shift) / (ROWS - 1) + jitter()))

  const editToken = randomToken()
  try {
    const row = await env.DB.prepare(
      `INSERT INTO participants (full_name, email, learning, x, y, edit_token, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7) RETURNING id`,
    )
      .bind(details.fullName, details.email, details.learning, x, y, editToken, Date.now())
      .first<{ id: number }>()
    return json({ id: row!.id, editToken })
  } catch (err) {
    // Two registrations with the same email at the same moment.
    if (isUniqueViolation(err)) return fail('email_taken', 409)
    throw err
  }
}
