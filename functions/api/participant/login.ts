import { checkAccessCode } from '../../../server/accessCode'
import { json, readJson, type Env } from '../../../server/auth'
import { fail } from '../../../server/errors'
import { normalizeEmail } from '../../../server/participant'

// Signs a participant back in on any device with their email + the current access code.
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = await readJson(request)
  const invalid = await checkAccessCode(env, body.code)
  if (invalid) return fail(invalid.code, invalid.status)

  const email = normalizeEmail(body.email)
  if (!email) return fail('email_required', 400)

  const row = await env.DB.prepare(
    'SELECT id, edit_token AS editToken, full_name AS fullName, email, learning FROM participants WHERE email = ?1',
  )
    .bind(email)
    .first()
  if (!row) return fail('participant_not_found', 404)
  return json(row)
}
