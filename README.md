# Pizarra de láminas · Slide Board

A class whiteboard where every student becomes a glass microscope slide. Each person enters
the current access code, writes their full name and one thing they learned in class, and their
slide appears on a shared public board. They can move it around, and come back later from any
device to edit it.

The UI is in **Spanish by default**, with an ES/EN switch on every page (remembered per browser).

## Pages

| Route | Who | What |
|---|---|---|
| `/` | Everyone | The public whiteboard (details below). |
| `/code` | Students | Registration step 1: the access code. `/code?code=XXXX` links and QR codes are checked automatically. |
| `/details` | Students | Step 2: full name, email and "¿Qué aprendiste en clase?" (up to 280 characters), with a live preview of the slide. Saving takes you back to the board. |
| `/login` | Students | Sign back in **on any device** with your email and the current access code. |
| `/edit` | Students | Edit your own slide. Your email is only visible here and to the admin. Saving takes you back to the board. |
| `/admin` | Super user | Access code, participants, password (details below). |

Unknown paths, and old `/board` links, open the board.

### The whiteboard

- The board is a fixed 3760 × 2040 canvas with fixed-size slides (360 × 120), enough for a 10 × 15
  grid of 150 slides with no overlap.
- New registrations fill the grid in arrival order.
- Controls: **Ajustar/Fit**, **100%**, and zoom in/out.
- The board refreshes every 3 s; there is no realtime connection.
- **Click a slide** and it grows smoothly from its spot to the centre of the screen. If the learning
  is cut off on the glass, the full text is shown in a card underneath. Close with ✕, by clicking
  outside, or with Esc.
- **Moving slides:**
  - Each student can drag **their own** slide (outlined in lilac). This works from the browser
    they registered or signed in with.
  - A logged-in admin can drag every slide.
  - A press that doesn't move counts as a click and opens the zoom view.
- **On phones** (≤ 640 px) the board opens as a **vertical list** of full-width slides:
  - The order follows the board, top to bottom and left to right.
  - It has a name search that ignores accents ("tomas" finds "Tomás").
  - A **Lista / Pizarra** switch shows the full board instead.
- The full name always fits on the slide's label: the text shrinks until it does. Long learnings
  end in "…" on the glass.

### The admin panel

- **Access code:** generate it, copy it, or copy a ready-made `/code?code=…` link (handy for a QR
  code).
  - There is one active code at a time. **Generating a new one makes the previous one stop working
    immediately.**
  - People already registered keep their slide.
  - Until the first code is generated, registration is closed.
- **Participants:** name, email, learning and registration time, newest first. You can search by
  name or email, and delete a slide (click twice to confirm).
- **Change password:** a collapsible section, closed by default. New passwords need at least 10
  characters.
- A link opens the board, where you can drag any slide.

## Stack

- **Frontend:** React 19 + Vite + TypeScript, plain CSS.
- **Hosting:** Cloudflare Pages.
- **API:** Cloudflare Pages Functions (`functions/`), with shared server code in `server/`.
- **Database:** Cloudflare D1 (SQLite). Locally, wrangler runs D1 as a SQLite file in
  `.wrangler/state`.

There is no separate database server or Docker image to run.

## Configuration (`.env`)

All settings for the database and the first super user live in `.env`. It is gitignored. Copy
`.env.example` to start:

```sh
cp .env.example .env
```

| Variable | Used for |
|---|---|
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` | Remote commands (deploy, remote migrations, remote admin). The token needs *Cloudflare Pages: Edit* and *D1: Edit*. Leave empty to use `pnpm wrangler login` instead. |
| `D1_DATABASE_NAME` | Name of the D1 database (default `slides-db`). |
| `D1_DATABASE_ID` | ID printed by `pnpm wrangler d1 create <name>`. Leave empty for local-only development. |
| `SUPERUSER_EMAIL` | The first super user, created by `pnpm setup:local` / `pnpm setup`. |
| `SUPERUSER_PASSWORD` | Their password. Leave empty to be asked for it (hidden). |

How the values are used:
- The `pnpm` scripts read `.env` through `scripts/env.mjs`.
- Before every wrangler command they write `D1_DATABASE_NAME` and `D1_DATABASE_ID` into
  `wrangler.toml`. Edit `.env`, not those lines.
- **Local development always uses a fixed local database id** (`preview_database_id`), so
  changing `D1_DATABASE_ID` never hides your local data.
- The deployed app doesn't read `.env`.
- `.dev.vars` (also gitignored) exists so that `wrangler pages dev` doesn't load `.env` into the
  local Worker. The token and password stay out of the app.

## Local development

Needs Node 20.12+ and pnpm.

```sh
pnpm install
cp .env.example .env    # set SUPERUSER_EMAIL (and SUPERUSER_PASSWORD, or you'll be asked)
pnpm setup:local        # creates / updates the local database and the super user
pnpm preview            # build + serve everything on http://localhost:8788
```

Then open `http://localhost:8788/admin`, log in, and generate an access code. Students register at
`/code`.

**Hot reload:** run `pnpm dev:api` (functions + D1 on :8788) and `pnpm dev` (Vite), which proxies
`/api` to it. `dev:api` serves the last build, so run `pnpm build` to refresh it.

**Looking at the local data:**

```sh
pnpm wrangler d1 execute DB --local --command "SELECT id, full_name, email FROM participants"
```

**A second, throwaway server** (for experiments that shouldn't touch your local data): give it its
own port and database folder.

```sh
pnpm wrangler d1 migrations apply DB --local --persist-to /tmp/slides-test
pnpm wrangler pages dev --port 8790 --persist-to /tmp/slides-test
```

### Scripts

| Script | What it does |
|---|---|
| `pnpm dev` | Vite dev server (proxies `/api` to :8788). |
| `pnpm dev:api` | Pages Functions + local D1 on :8788. |
| `pnpm preview` | Build, then serve the whole app on :8788. |
| `pnpm build` | Type-check the app and the functions, then build to `dist/`. |
| `pnpm lint` | ESLint. |
| `pnpm db:migrate:local` / `pnpm db:migrate` | Apply pending migrations to the local / remote database. |
| `pnpm admin:create:local [email]` / `pnpm admin:create [email]` | Create an admin, or reset an admin's password, in the local / remote database. The email defaults to `SUPERUSER_EMAIL`. |
| `pnpm setup:local` / `pnpm setup` | Migrations plus the super user from `.env`, local / remote. |
| `pnpm wrangler <args>` | Any wrangler command, with `.env` loaded and `wrangler.toml` synced. |
| `pnpm deploy` | Build and deploy to Cloudflare Pages. |

## Deploy

**First time:**

1. Fill in `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` in `.env`, or run `pnpm wrangler login`.
2. Then:

```sh
pnpm wrangler d1 create slides-db                       # paste the id it prints into D1_DATABASE_ID in .env
pnpm setup                                              # remote migrations + super user from .env
pnpm wrangler pages project create web-slides-students
pnpm deploy
```

Then log in at `/admin`, **change the password**, and generate the first access code.

**Updating an existing deployment:** run `pnpm db:migrate` first if `migrations/` has new files,
then `pnpm deploy`. Migrations keep existing data.

## Deploy the website on Vercel (optional)

Vercel can serve the website, but it can't run the API or the database: Pages Functions and D1
only run on Cloudflare. `vercel.json` handles the split:

- Vercel builds and serves the React app (`pnpm build` → `dist/`), with every page route sent to
  `index.html`.
- Every `/api/*` request is forwarded to the Cloudflare deployment. To the browser everything
  stays on your Vercel domain, so admin login cookies work and no CORS setup is needed.

Steps:

1. Deploy to Cloudflare first (above). The API must be live there.
2. In `vercel.json`, check that the `/api/:path*` destination matches your Cloudflare Pages URL. It
   defaults to `https://web-slides-students.pages.dev`; use your custom domain if you added one.
3. Import the repo in Vercel. Framework, install, build and output are all set in `vercel.json`.
   To make Vercel use the pinned pnpm version (`packageManager` in `package.json`), add the
   environment variable `ENABLE_EXPERIMENTAL_COREPACK=1` in the Vercel project settings.
4. Deploy. No other Vercel environment variables are needed: the database and secrets stay on
   Cloudflare.

What to know:
- **Admin login rate limiting:** behind Vercel, the API sees Vercel's servers instead of each
  visitor's IP. All admin login attempts therefore share one limit of 10 failures per 15 minutes.
  This doesn't affect students, who don't log in with a password.
- **The Cloudflare URL still works directly** and serves the same app.

## Admin users

- `pnpm admin:create [email]` adds an admin. For an existing admin it resets the password and logs
  out their sessions.
- `admin:create:local` does the same in the local database.
- The email defaults to `SUPERUSER_EMAIL`.
- The password comes from `ADMIN_PASSWORD` or `SUPERUSER_PASSWORD`, or a hidden prompt. It's
  never passed on the command line.
- Only its salted PBKDF2 hash is stored in the database.
- **After the first login, change the password in `/admin` and clear `SUPERUSER_PASSWORD` from
  `.env`**, so the real password doesn't sit in a file. Leave it empty and the script will ask.
- Running `admin:create` again resets that admin's password to whatever `.env` (or the prompt)
  says, so don't re-run it by accident.

## Security and privacy

- **Emails stay private:** the public board API (`GET /api/slides`) only returns id, full name,
  learning and position. Emails are visible only to their owner (at `/edit`) and in the admin panel.
- **Admin sessions** use HttpOnly, SameSite=Strict cookies that last 7 days. Admin login is rate
  limited to 10 failed attempts per IP per 15 minutes.
- **Students have no password.**
  - Registering and signing back in both need the **current** access code.
  - Editing and moving a slide need its secret edit token, which the student's browser stores
    after registering or signing in.
  - Anyone who knows the current code and a student's email can sign in as that student. That's
    fine for a classroom; regenerate the code after class to close it.
- Emails are unique, compared case-insensitively.

## Project structure

```
functions/api/            Pages Functions (one file per route)
  register.ts               POST   /api/register            new slide (needs current code)
  check-code.ts             POST   /api/check-code          validate code (step 1)
  participant/index.ts      PUT    /api/participant         edit own slide (edit token)
  participant/login.ts      POST   /api/participant/login   email + code -> edit token
  slides/index.ts           GET    /api/slides              public board data
  slides/[id].ts            PUT    /api/slides/:id          move (owner token or admin)
                            DELETE /api/slides/:id          delete (admin)
  auth/                     admin login / logout / me / password
  admin/                    access code (GET/POST), participants list
server/                   shared server code: auth & sessions, access code, validation,
                          error codes (errors.ts)
migrations/               D1 schema, applied in order (never edit an applied one; add a new file)
scripts/create-admin.mjs  create / reset an admin
src/
  BoardPage.tsx           whiteboard: canvas, zoom, drag, phone list view
  SlideZoom.tsx           click-to-zoom view
  GlassSlide.tsx          the slide itself (name auto-fit, learning, stained tissue)
  RegisterPage.tsx        /code, /details, /login, /edit
  AdminPage.tsx           /admin
  api.ts                  typed API client
  myEntry.ts              this browser's own slide (localStorage)
  i18n/                   translations, one file per area (see below)
  ui/                     TopBar, Brand, LangToggle, Rich
  index.css               design system + board/slide styles
  register.css, admin.css page styles
```

## Translations

- Strings live in `src/i18n/<area>.ts` (`common`, `board`, `register`, `admin`, `errors`), each
  shaped `{ es: {...}, en: {...} }`.
- Use them as `t('area.key')`. Values can include `{placeholders}`, and `<em>…</em>` for the lilac
  accent in headings.
- **API errors:** the API returns `{ error, code }`. The frontend shows `errors.<code>` from
  `src/i18n/errors.ts`, falling back to the English `error` text. To add one, add the code to
  `server/errors.ts` and translate it in `src/i18n/errors.ts`.
- If a key is missing in English, the Spanish text is shown.

## Design

The look is called **"H&E"**, after hematoxylin and eosin, the two stains on a real pathology slide.

- **Colours:** hematoxylin gives the lilac accent (`--lilac`) and the violet used for actions
  (`--violet`). Eosin gives the pink (`--eosin`).
- **Fonts:** headings in *Fraunces*, the interface in *Figtree*, and slides handwritten in *Caveat*.
- **Shared classes:** tokens and components (`.btn`, `.card`, `.field`, `.input`, `.chip`,
  `.notice`, …) are in `src/index.css`.
- Animations respect `prefers-reduced-motion`.

## Troubleshooting

- **The board says "Se perdió la conexión, reintentando…" / "Connection lost"**
  - The API call is failing.
  - The most common cause is a migration that hasn't been applied. Run `pnpm db:migrate:local`
    (or `pnpm db:migrate` on the deployment).
  - Also check that the server is running.
- **`Address already in use` when starting wrangler:** another `wrangler pages dev` is already
  using that port. Stop it, or use `--port` with another number.
- **Registration says it's closed:** no access code has been generated yet. Generate one in `/admin`.
