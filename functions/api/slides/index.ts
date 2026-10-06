import { json, type Env } from '../../../server/auth'

// Public board data: only what the whiteboard needs, never emails or tokens.
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const { results } = await env.DB.prepare(
    'SELECT id, full_name AS fullName, learning, x, y FROM participants ORDER BY id',
  ).all()
  return json(results)
}
