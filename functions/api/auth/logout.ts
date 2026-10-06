import { destroySession, json, type Env } from '../../../server/auth'

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) =>
  json({ ok: true }, 200, { 'Set-Cookie': await destroySession(env, request) })
