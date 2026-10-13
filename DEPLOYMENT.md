# Deploying Church Ops

The app is a standard Next.js server app. It needs a host that runs Node —
Vercel is the path of least resistance since Next.js is their framework, and
the free tier is enough for a staff of fifteen.

Supabase and ImageKit are already hosted, so only the web app gets deployed.

## Environment variables

Only **four** of the eight variables in `.env.local` belong in production.

### Ship these

| Variable | Why |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Which Supabase project to talk to |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public client key; RLS is what actually protects the data |
| `NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY` | Identifies the account for browser uploads |
| `IMAGEKIT_PRIVATE_KEY` | Server-only. Signs upload grants and authorises deletion |

### Do NOT ship these

| Variable | Why not |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | **Bypasses every RLS policy in the app.** Used only by `scripts/create-user.mjs` on your own machine. In production it is a liability with no purpose — anything that leaks it defeats the entire permission model |
| `DATABASE_URL` | Direct Postgres connection, used only by `scripts/db-setup.mjs` |
| `SETUP_USER_PASSWORD` | Local account-creation script only |
| `NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT` | Currently unused — ImageKit returns absolute URLs on upload. Kept because it is the conventional ImageKit variable and will be wanted if the ImageKit SDK is ever adopted |

The `NEXT_PUBLIC_` prefix means a value is compiled into the browser bundle and
is visible to anyone. That is correct for the three that carry it, and is
exactly why the service role key must never be given that prefix.

## First deploy

1. Log in (only you can do this — it opens a browser):

   ```
   npx vercel login
   ```

2. Link the project, from the repository root:

   ```
   npx vercel link
   ```

3. Add the four production variables. Each command prompts for the value, so
   secrets are never typed into a shell history or a file:

   ```
   npx vercel env add NEXT_PUBLIC_SUPABASE_URL production
   npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
   npx vercel env add NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY production
   npx vercel env add IMAGEKIT_PRIVATE_KEY production
   ```

4. Deploy:

   ```
   npx vercel --prod
   ```

## After the first deploy

- **Logging in works unchanged.** Sign-in is email and password
  (`signInWithPassword`), not magic links, so there are no Supabase redirect
  URLs to configure. This is the usual thing that breaks a first deploy and it
  does not apply here.
- **Migrations do not run automatically.** Everything through `0009` is already
  applied to the live project. Any future migration must be run by hand in the
  Supabase SQL editor.
- **Timezone.** Production runs in UTC. The weekly board deliberately computes
  its week in `America/New_York` (`src/lib/weekly.ts`) so it resets on Sunday
  morning locally rather than Saturday evening. If the church is not Eastern,
  change `CHURCH_TIMEZONE` there.

## Branches and previews

Vercel is connected to the GitHub repository, so deployment follows git:

| You push to | Vercel builds | Who can see it |
| --- | --- | --- |
| `main` | Production, at the live URL | Anyone with the link (then the app's own login) |
| any other branch | A preview, at its own URL | Only people signed in to the Vercel account |

Preview builds get their own copy of the same four environment variables, so a
branch deploys and runs exactly like production.

### Previews have their own database

There are two Supabase projects:

| Project | Ref | Used by |
| --- | --- | --- |
| New Life Church Database | `ibfakkzktnxxtutlimni` | Production |
| newlife-ops-preview | `dhpjchtgkmauwqbhvzjz` | Every preview deployment |

The preview project has the same schema and the same seeded org chart, and no
real work in it. A branch can therefore delete every task in a preview without
touching anything real.

Two things to know:

**New migrations have to be applied twice** -- once to each project -- or a
preview will fail against a schema the branch expects. The preview project was
set up by applying every migration in `supabase/migrations/` in order,
followed by `supabase/seed.sql`.

**ImageKit is still shared.** Both projects upload to the same ImageKit
account, since storage is not the thing previews were risking. A preview can
only delete files its own database has rows for, which is why this is
tolerable rather than ideal.

### Working on a branch

```
git checkout -b some-change
# ...edit, commit...
git push -u origin some-change
```

Vercel comments the preview URL on the pull request, or it can be found with
`npx vercel ls`. Merging the branch into `main` deploys it to production.

To undo a bad production deploy, roll back to the previous one in the Vercel
dashboard rather than pushing a hurried fix.

## Who can reach it

The deployment is public in the sense that anyone with the URL sees the login
page. Access is controlled by Supabase accounts: a person can only sign in if
you created an account for them with `scripts/create-user.mjs`. The org chart
rules are enforced by row level security in the database, not by the UI, so
they hold even against someone poking at the API directly.
