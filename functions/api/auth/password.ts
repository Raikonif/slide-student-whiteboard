import { adminOnly, hashPassword, json, readJson, verifyPassword } from '../../../server/auth'
import { fail } from '../../../server/errors'

export const onRequestPost = adminOnly(async ({ request, env }, admin) => {
  const body = await readJson(request)
  const currentPassword = String(body.currentPassword ?? '')
  const newPassword = String(body.newPassword ?? '')
  if (newPassword.length < 10) return fail('password_too_short', 400)

  const row = await env.DB.prepare('SELECT password_hash FROM admins WHERE id = ?1')
    .bind(admin.id)
    .first<{ password_hash: string }>()
  if (!row || !(await verifyPassword(currentPassword, row.password_hash)))
    return fail('wrong_current_password', 401)

  await env.DB.prepare('UPDATE admins SET password_hash = ?1 WHERE id = ?2')
    .bind(await hashPassword(newPassword), admin.id)
    .run()
  return json({ ok: true })
})
