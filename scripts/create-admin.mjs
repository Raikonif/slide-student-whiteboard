// Creates (or resets the password of) an admin user in D1.
// Usage: node scripts/create-admin.mjs [email] [--remote]
// Email defaults to SUPERUSER_EMAIL from .env. The password comes from ADMIN_PASSWORD or
// SUPERUSER_PASSWORD (.env), or a hidden prompt; it is never passed as an argument.
import { pbkdf2Sync, randomBytes } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { env, loadEnv, runWrangler } from './env.mjs'

loadEnv()

// Must match server/auth.ts (Workers caps PBKDF2 at 100k iterations).
const ITERATIONS = 100_000

const args = process.argv.slice(2)
const email = (args.find((a) => !a.startsWith('--')) ?? env('SUPERUSER_EMAIL')).trim().toLowerCase()
const remote = args.includes('--remote')
if (!email || !email.includes('@')) {
  console.error('Usage: node scripts/create-admin.mjs [email] [--remote]  (or set SUPERUSER_EMAIL in .env)')
  process.exit(1)
}

function promptHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    rl._writeToOutput = (s) => rl.output.write(s.startsWith(question) ? s : '')
    rl.question(question, (answer) => {
      rl.close()
      process.stdout.write('\n')
      resolve(answer)
    })
  })
}

const password =
  env('ADMIN_PASSWORD') || env('SUPERUSER_PASSWORD') || (await promptHidden(`Password for ${email}: `))
if (!password) {
  console.error('Password is required.')
  process.exit(1)
}

const salt = randomBytes(16)
const hash = pbkdf2Sync(password, salt, ITERATIONS, 32, 'sha256')
const stored = `pbkdf2$${ITERATIONS}$${salt.toString('base64')}$${hash.toString('base64')}`
const sql = `INSERT INTO admins (email, password_hash, created_at) VALUES ('${email.replace(/'/g, "''")}', '${stored}', ${Date.now()})
ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash;
DELETE FROM sessions WHERE admin_id = (SELECT id FROM admins WHERE email = '${email.replace(/'/g, "''")}');
`

// Write to a temp file (not the repo) and remove it right after.
const dir = mkdtempSync(join(tmpdir(), 'slides-admin-'))
const file = join(dir, 'admin.sql')
try {
  writeFileSync(file, sql)
  const status = runWrangler(['d1', 'execute', 'DB', remote ? '--remote' : '--local', '--file', file], { quiet: true })
  if (status !== 0) process.exitCode = status
  else console.log(`Admin ${email} saved to ${remote ? 'remote' : 'local'} D1.`)
} finally {
  rmSync(dir, { recursive: true, force: true })
}
