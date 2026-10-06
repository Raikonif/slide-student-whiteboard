import { checkAccessCode } from '../../server/accessCode'
import { json, readJson, type Env } from '../../server/auth'
import { fail } from '../../server/errors'

// Step 1 of registration: validates the code before showing the details form.
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const invalid = await checkAccessCode(env, (await readJson(request)).code)
  if (invalid) return fail(invalid.code, invalid.status)
  return json({ ok: true })
}
