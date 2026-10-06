// `node scripts/wrangler.mjs <wrangler args>`: wrangler with .env loaded and wrangler.toml synced.
import { loadEnv, runWrangler } from './env.mjs'

loadEnv()
try {
  process.exit(runWrangler(process.argv.slice(2)))
} catch (err) {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
}
