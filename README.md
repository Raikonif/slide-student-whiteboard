# Slide Board

People enter the current access code and their name. Each person becomes a glass
microscope slide on a public whiteboard.

- `/` is the public whiteboard (refreshes every 3 s): a fixed 3200 x 1950 canvas of fixed-size
  slides (room for 150 in a grid), with Fit / 100% / zoom controls. **Click a slide** to zoom it
  smoothly to the centre; if its learning doesn't fit on the glass, the full text is shown below it.
  Each person can drag **their own** slide; a logged-in admin can drag any slide.
  On phones the board opens as a **vertical list** of full-width slides in reading order
  (top to bottom, left to right), with a name search and a List / Board switch.
- `/code` → `/details` registers: access code first, then full name, email (required, private —
  only the owner and the admin see it) and "What did you learn in class?" (up to 280 characters).
  After saving you land back on the board.
- `/login` → `/edit` lets an owner sign back in **on any device** with their email + the current
  access code, edit their slide, and return to the board.
- `/admin` is the super user panel. From there you can:
  - generate the access code (**a new code makes the previous one invalid right away**;
    people already registered keep their slide)
  - see participants with their emails, and delete slides
  - change your password

The UI is in **Spanish by default**, with an ES/EN switch on every page (remembered per browser).

Stack: React + Vite on **Cloudflare Pages**, API in **Pages Functions** (`functions/`, shared code
in `server/`), data in **Cloudflare D1** (SQLite). Admin passwords are stored as PBKDF2 hashes,
sessions are HttpOnly cookies, and login is rate limited (10 failures per IP per 15 min).
The public board never receives emails.

## Local development

```sh
pnpm install
pnpm db:migrate:local
pnpm admin:create:local nandyycp@gmail.com   # prompts for the password (hidden)
pnpm preview                                  # build + serve on http://localhost:8788
```

For hot reload: run `pnpm dev:api` (API on :8788, rebuild with `pnpm build` to refresh it)
and `pnpm dev` (Vite proxies `/api` to it).

## Deploy (one time)

```sh
npx wrangler login
npx wrangler d1 create slides-db          # copy the database_id into wrangler.toml
pnpm db:migrate
pnpm admin:create nandyycp@gmail.com      # creates the super user in the remote DB
npx wrangler pages project create web-slides-students
pnpm deploy
```

Then log in at `/admin`, **change the password**, and generate the first code.

## Admin users

`pnpm admin:create <email>` adds an admin, or resets an existing admin's password and logs
out their sessions. Use `admin:create:local` for the local DB. The password is never written
to disk or to the repo.
