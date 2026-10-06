import { adminOnly, json } from '../../../server/auth'

export const onRequestGet = adminOnly(async ({ env }) => {
  const { results } = await env.DB.prepare(
    `SELECT id, full_name AS fullName, email, learning, created_at AS createdAt
       FROM participants ORDER BY created_at DESC`,
  ).all()
  return json(results)
})
