import { json, readJson, type Env } from '../../../server/auth'
import { fail } from '../../../server/errors'
import { isUniqueViolation, validateDetails } from '../../../server/participant'

// Lets the slide's owner edit its details, even after the access code rotated.
export const onRequestPut: PagesFunction<Env> = async ({ request, env }) => {
  const body = await readJson(request)
  const editToken = String(body.editToken ?? '')
  if (!editToken) return fail('missing_token', 400)

  const details = validateDetails(body)
  if ('error' in details) return fail(details.error, 400)

  try {
    const row = await env.DB.prepare(
      `UPDATE participants SET full_name = ?1, email = ?2, learning = ?3
        WHERE edit_token = ?4 RETURNING id`,
    )
      .bind(details.fullName, details.email, details.learning, editToken)
      .first<{ id: number }>()
    if (!row) return fail('entry_gone', 404)
    return json({ id: row.id })
  } catch (err) {
    if (isUniqueViolation(err)) return fail('email_taken', 409)
    throw err
  }
}
