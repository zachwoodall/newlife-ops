# Church Ops

Internal staff tool for managing departments, people, and week-to-week task
ownership.

See [PLAN.md](PLAN.md) for the full milestone plan.

**Stack:** Next.js 16 (App Router) + TypeScript + Tailwind v4 · Supabase (auth +
Postgres) · ImageKit (media)

## Running it

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## First-time setup

1. Copy `.env.local.example` to `.env.local` and fill in the Supabase values.
2. In the Supabase SQL Editor, run `supabase/migrations/0001_org_structure.sql`,
   then `supabase/seed.sql`.
3. Create your user in the Supabase dashboard under **Authentication → Users →
   Add user**, with *Auto Confirm User* checked.

## Environment variables

Copy `.env.local.example` to `.env.local` and fill in real values:

```bash
cp .env.local.example .env.local
```

`.env.local` is gitignored. Variables prefixed `NEXT_PUBLIC_` are sent to the
browser; the rest are server-only and must stay that way.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server at localhost:3000 |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm test` | Unit + schema tests (real Postgres via PGlite) |
| `npm run seed:generate` | Rebuild `supabase/seed.sql` from `seed/org.json` |
| `npx tsc --noEmit` | Typecheck |

## Progress

- [x] **M1** — Project skeleton
- [x] **M2** — Supabase auth and the protected shell
- [x] **M3** — Campuses, people, positions *(applied to the live project)*
- [x] **M3b** — Campus switcher
- [x] **M4** — The org chart (read-only)
- [ ] **M5** — Editing the org chart
- [x] **M6** — Task data and the Task Directory *(plus edit and delete)*
- [ ] **M7** — Home's top 5
- [ ] **M8** — The project board
- [ ] **M9** — Recurrence, deadlines, and reminders
- [ ] **M10** — Assign and message from the org chart
- [ ] **M11** — Messages
- [ ] **M12** — ImageKit media on tasks
- [ ] **M13** — The weekly to-do board

## Known advisories

`npm audit` reports 5 high-severity issues, all from a single transitive
dependency (`braces`) reached only through `eslint-config-next`. It is a
lint-time-only dependency that never runs in production, and the advisory is a
denial of service triggered by deeply nested glob patterns — which would mean
feeding hostile patterns to your own linter. The automated fix downgrades
`eslint-config-next` from 16.3.8 to 14.2.35, which breaks linting against
Next 16. Left as-is deliberately; revisit when upstream bumps the dependency.
