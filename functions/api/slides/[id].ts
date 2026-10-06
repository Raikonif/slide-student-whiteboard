import { adminOnly, getAdmin, json, readJson, type Env } from '../../../server/auth'
import { fail } from '../../../server/errors'

const clamp = (n: number) => Math.min(1, Math.max(0, n))

// Saves a slide's position. Allowed for admins, and for the slide's owner via its edit token.
export const onRequestPut: PagesFunction<Env, 'id'> = async ({ request, env, params }) => {
  const id = Number(params.id)
  const editToken = request.headers.get('x-edit-token')
  if (!editToken && !(await getAdmin(env, request))) return fail('not_allowed', 401)

  const body = await readJson(request)
  const x = Number(body.x)
  const y = Number(body.y)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return fail('bad_position', 400)

  const result = editToken
    ? await env.DB.prepare('UPDATE participants SET x = ?1, y = ?2 WHERE id = ?3 AND edit_token = ?4')
        .bind(clamp(x), clamp(y), id, editToken)
        .run()
    : await env.DB.prepare('UPDATE participants SET x = ?1, y = ?2 WHERE id = ?3').bind(clamp(x), clamp(y), id).run()

  if (!result.meta.changes) return editToken ? fail('not_your_slide', 403) : fail('not_found', 404)
  return json({ ok: true })
}

// Removes a slide from the board.
export const onRequestDelete = adminOnly<'id'>(async ({ env, params }) => {
  const result = await env.DB.prepare('DELETE FROM participants WHERE id = ?1').bind(Number(params.id)).run()
  if (!result.meta.changes) return fail('not_found', 404)
  return json({ ok: true })
})
