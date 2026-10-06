// Shared helpers for the project scripts: load .env, keep wrangler.toml in sync, run wrangler.
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

// Local D1 data is stored under a file keyed by this id. It stays fixed so changing
// D1_DATABASE_ID (the real, remote database) never "loses" the local database.
const LOCAL_DATABASE_ID = '00000000-0000-0000-0000-000000000000'

export function loadEnv() {
  // Real environment variables win over .env (Node's loader never overwrites them).
  if (existsSync('.env')) process.loadEnvFile('.env')
}

export function env(name, fallback = '') {
  return (process.env[name] ?? '').trim() || fallback
}

// Writes D1_DATABASE_NAME / D1_DATABASE_ID from .env into wrangler.toml, which wrangler reads.
export function syncWranglerToml({ remote }) {
  const name = env('D1_DATABASE_NAME', 'slides-db')
  const id = env('D1_DATABASE_ID')
  if (remote && !id)
    throw new Error(
      'D1_DATABASE_ID is empty in .env. Create the database with `pnpm wrangler d1 create <name>` ' +
        'and paste the id it prints into .env.',
    )
  const before = readFileSync('wrangler.toml', 'utf8')
  const after = before
    .replace(/^database_name = ".*"$/m, `database_name = "${name}"`)
    .replace(/^database_id = ".*"$/m, `database_id = "${id || LOCAL_DATABASE_ID}"`)
    .replace(/^preview_database_id = ".*"$/m, `preview_database_id = "${LOCAL_DATABASE_ID}"`)
  if (after !== before) writeFileSync('wrangler.toml', after)
}

// Runs wrangler with .env loaded (CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, ...); returns its exit code.
export function runWrangler(args, { quiet = false } = {}) {
  const remote = args.includes('--remote') || args[0] === 'deploy' || args[1] === 'deploy'
  syncWranglerToml({ remote })
  const result = spawnSync('npx', ['wrangler', ...args], {
    stdio: quiet ? ['inherit', 'ignore', 'inherit'] : 'inherit',
    env: process.env,
  })
  return result.status ?? 1
}
