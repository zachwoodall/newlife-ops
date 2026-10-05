# Church Ops — Build Plan

Internal staff tool for managing departments, people, and week-to-week task
ownership. Scope is fixed to the three pages described below. Nothing else.

**Stack:** Next.js (App Router) + Tailwind · Supabase (auth + Postgres + RLS) · ImageKit (all media)

**Brand:** Primary blue `#175B9D`, white, black. Core values: Worship · Word ·
Walk · Witness. Palette is wired into Tailwind as `brand-50` through
`brand-900`; see [src/app/globals.css](src/app/globals.css).

---

## The three pages

**1. Home** — "Welcome, {name}" + the top 5 incomplete tasks for this week.

**2. My Department** — Your department (e.g. Worship). Editable org chart showing
your supervisor above you and your team members below you. Click a person to
message them or assign them a task.

**3. Task Directory** — Everything you personally own, grouped by cadence
(weekly / monthly / quarterly / yearly). Recurring schedules, deadlines,
reminders, tagged co-assignees, and uploaded files. Click a task to open its
project board. Plus a separate weekly to-do board for small recurring reminders
that don't need a full board.

### Two rules that run through everything

- **Tasks flow downward only.** You can assign a task to anyone below you in the
  org chart. Never to anyone above you.
- **Messages go anywhere.** Any staff member can message any other staff member.

---

## Milestone 0 — Install Node

Your Mac doesn't have Node, npm, or Homebrew. Nothing can be built until it does.

Download the **Node.js LTS installer for macOS (Intel / x64)** from
[nodejs.org](https://nodejs.org) and run the `.pkg`. This is the simplest path —
Homebrew is not well supported on macOS 12 anymore and isn't needed here.

**Verify:** `node --version` and `npm --version` both print a version number.

---

## Phase 1 — Foundation

### Milestone 1 — Project skeleton

Scaffold the Next.js app with the App Router, TypeScript, and Tailwind. Set up
`.env.local` for Supabase and ImageKit keys, and `.gitignore` so keys never get
committed. Initialize the git repo.

**Verify:** `npm run dev` serves a Tailwind-styled placeholder page at
`localhost:3000`.

### Milestone 2 — Supabase auth and the protected shell

Create the Supabase project. Wire up server-side auth sessions so pages can read
the signed-in user. Build a login page and a sign-out button. Every page except
login redirects to login when signed out. Add the persistent app shell: a nav bar
with the three page links (Home / My Department / Task Directory) and empty
placeholder pages behind each.

**Verify:** You sign in as a test user and land on Home. You can click between
all three pages. Sign out returns you to login. Visiting any page while signed
out bounces you to login.

### Milestone 3 — Campuses, people, and positions

The data backbone. Your two org charts changed the shape of this milestone —
details and reasoning in [ORG-NOTES.md](ORG-NOTES.md). Four tables:

- `campuses` — Holly Springs and Union Hill
- `people` — one row per human: name, email, login link. 15 of them.
- `positions` — one row per *role*: title, department, campus, and which
  position it reports to. 22 of them, 6 currently unfilled.
- `position_holders` — which people hold which positions

**Positions are separate from people**, because your charts need three things a
single staff table can't do: hold open roles with nobody in them, put two people
in one box (Zach & Sarah Woodall, John Booth & Josh Floyd), and let one person
hold roles at both campuses (Zach, John Booth, Charlie Shultz all do).

Row-level security so a signed-in user can read the staff directory but can only
edit what they're allowed to edit.

Seed from [seed/org.json](seed/org.json), which already holds both charts.

> **Still needed: staff email addresses.** Everything else is captured.

**Verify:** Home greets you by your real name from the database. Querying your
position returns the right supervisor and direct reports. Open positions show as
unfilled rather than vanishing.

### Milestone 3b — Campus switcher

People who hold positions at both campuses get a campus toggle in the app
header. Switching changes which campus's org chart and tasks you see. People at
one campus never see the toggle — it just isn't there for them.

Your selected campus persists across page loads, so you don't re-pick it every
visit.

**Verify:** Sign in as Zach (positions at both campuses) and see the toggle;
switch and watch the department view change. Sign in as Brandon Ford (Holly
Springs only) and confirm no toggle appears.

## Phase 2 — My Department

### Milestone 4 — The org chart (read-only)

The My Department page renders your department's chart: your supervisor in a card
above you, you in the middle, your direct reports in cards below. Each card shows
name, title, and department. If you have no reports, the section below you is
simply empty.

**Verify:** Sign in as a worship team member and see the Worship chart with the
executive pastor above. Sign in as someone in a different department and see
theirs instead.

### Milestone 5 — Editing the org chart

Add a person, edit a person's name/title/department, change who someone reports
to, and remove a person. Reassigning a supervisor moves the card in the chart.
Guard against the one structural mistake that breaks a tree: you can't make
someone report to their own subordinate.

**Verify:** Move a team member from one supervisor to another and watch the chart
redraw. Reload the page — the change persisted. Try to create a reporting loop
and get a clear error instead of a broken chart.

---

## Phase 3 — Tasks

### Milestone 6 — Task data and the Task Directory

The tasks table: title, notes, who owns it, which department, cadence
(weekly / monthly / quarterly / yearly / one-off), due date, and status.

The **downward-only assignment rule lives here**, enforced in the database — not
just hidden in the UI. A database rule walks the supervisor chain and rejects any
task assigned to someone who isn't below the assigner. This means the rule holds
even if someone pokes at the API directly.

The Task Directory page lists everything you own, grouped into Weekly / Monthly /
Quarterly / Yearly sections, each sorted by due date, with overdue items marked.

**Verify:** Create tasks at each cadence and see them land in the right sections.
Attempt to assign a task to your supervisor and get rejected.

### Milestone 7 — Home's top 5

Now that tasks exist, fill in the Home widget: the 5 incomplete tasks due this
week, soonest first, each linking to its task. A clean empty state when you're
all caught up.

**Verify:** Create six tasks due this week. Home shows five. Complete one and the
sixth takes its place.

### Milestone 8 — The project board

Clicking a task opens its board. The board holds everything about that one
objective: description, status, due date, the **assigned roles** (each person on
the task with their role on it), and **co-assigned helpers you add by tagging
them**. A checklist of sub-items for the task's moving parts.

**Verify:** Open a task, tag two helpers with roles, check off sub-items, reload
and find it all intact. The tagged helpers see the task when they sign in.

### Milestone 9 — Recurrence, deadlines, and reminders

A recurring task is stored as a **schedule** ("Plan Sunday setlist, every Monday")
that generates **individual dated occurrences**. This matters: it's what lets you
mark *this week's* setlist done without erasing the fact that next week's is due.
Completing one occurrence never touches the others.

Reminders start as **in-app only** — a badge and a due-soon list. Email reminders
need a separate email service and are deliberately left for later.

**Verify:** Create a weekly recurring task. Several weeks of occurrences appear on
the right dates. Complete this week's; next week's stays open and on schedule.

---

## Phase 4 — Collaboration and media

### Milestone 10 — Assign and message from the org chart

Clicking a person's card in the org chart opens their actions: **Assign task**
(only shown for people below you) and **Send message** (shown for everyone). The
assign form creates a task owned by that person and drops it into their directory.

**Verify:** Click a team member, assign them a task, sign in as them, find it on
their Home and in their Task Directory. Click your supervisor — the assign option
isn't offered.

### Milestone 11 — Messages

One-to-one message threads between any two staff members. An inbox with unread
counts, a thread view, and a reply box.

**Verify:** Message someone two levels above you. Sign in as them and read it.
Reply, and see the reply as yourself. Unread counts clear when read.

### Milestone 12 — ImageKit media on tasks

The full media layer. Upload documents, images, and video to any task's project
board. Uploads go straight to ImageKit from the browser, authorized by a signature
your server generates — your ImageKit private key never reaches the browser.
Images and video get automatic thumbnails, video plays in the ImageKit player, and
documents appear as download links. Files are listed on the board with who
uploaded them and when.

**Verify:** Upload a PDF, a photo, and a short video to one task. The photo and
video show thumbnails, the video plays inline, the PDF downloads. All three are
still there after reload.

### Milestone 13 — The weekly to-do board

The lightweight board, separate from full project boards: small recurring
reminders of things you should always be doing. Check them off through the week;
they reset for the new week. Add, reorder, and remove items.

**Verify:** Add several weekly items, check some off, and confirm they reset at
the start of the new week.

---

## Suggestions

These are recommendations, not changes to your scope. Say the word and I'll adjust.

**Build and verify Milestones 0–3 before anything else.** Nothing downstream
works without login and real people in the database. If you only get one sitting
in, make it that.

**Start with in-app reminders, add email later.** Email requires a sending
service and domain verification — a real side quest. The in-app version delivers
the reminder value now, and email slots in cleanly afterward.

**Let one person belong to one department for now.** Worship/media overlap is
common in churches, and multi-department people are easy to add later. Starting
with one keeps the org chart a clean tree instead of a tangle.

**Deploy to Vercel after Milestone 7.** Once Home and the Task Directory work,
getting it on a real URL lets your staff start using it and giving feedback while
the rest gets built.

## Questions

Answered by the org charts: your departments, who's in them, and the fact that
the Senior Pastor sits above the Executive Pastor. Still open:

1. **Email addresses for all 15 staff.** This is the one blocker left for
   Milestone 3 — email is the login identity, so nobody can sign in without it.
   A plain list of name → email is all I need.

2. **Can the Union Hill Campus Pastor assign tasks to Union Hill department
   directors?** By the chart they report to their Holly Springs department head,
   so the downward-only rule would block it — Zach as Campus Pastor couldn't
   assign anything to the Union Hill Worship Director. That seems wrong in
   practice. I'd suggest campus pastors can also assign to anyone at their
   campus. Your call, and it's a one-line rule change either way.

3. **How should staff sign in — password or emailed login link?** Login links
   mean no passwords to reset, usually right for a small staff. Passwords are
   more familiar.

4. **Can a department head see their whole team's tasks, or only their own?**
   Your description says the Task Directory shows what *you* personally own. I'll
   build exactly that unless supervisors should also see their team's work.

5. **Fonts.** The brand kit specifies CMG Sans, which is a licensed font and not
   available for web use. I'd suggest Poppins or Jost — both free, both
   geometric, both close to the Century Gothic feel of the logo. Currently the
   app still uses the Next.js default. One-line swap once you pick.

6. **Logo files.** I can see both logo variations in the brand kit PDF but can't
   pull them out cleanly. If you can export the wordmark and the cross mark as
   **SVG** (or PNG with transparency), they'll go in the app header.

7. **Pantone 2945 C hex was cut off** in the brand kit — it reads "#668". I used
   Pantone's published `#00549F`. Confirm against your print assets if it
   matters.
