# Org Structure Notes

What the two org charts told us, and what it changed. Source of truth for the
data itself is [seed/org.json](seed/org.json).

**Read from:** `New Life Staff Org Chart Holly Springs.pdf`,
`New Life Union Hill Org Chart.pdf`

## What's in there

**15 people. 22 positions. 2 campuses. 6 roles currently open.**

Holly Springs runs Senior Pastor (Dr. Allan Malloy) → Executive Pastor (JB
Kitts) → eight departments: Worship, Students, Kids, Production, Pastoral Care,
Administrative, Facilities, Small Groups. Worship, Students, and Kids each have
one person beneath them.

Union Hill runs the same top two, then Campus Pastor (Zach Woodall). Beneath
that sits a Campus Coordinator reporting to the Campus Pastor, and seven
department director roles that report back to their **Holly Springs** department
head rather than to the campus pastor.

## Three things that changed the data model

### 1. Positions have to exist separately from people

Six Union Hill roles are open — Campus Coordinator, Worship, Kids, Student,
Small Groups, and Next Steps Directors. A staff table can't hold a role with
nobody in it; the row would have no name, no email, and no login. So roles live
in `positions`, and people get attached to them through `position_holders`.

This also means hiring is just filling a position, and the org chart doesn't
have to be rebuilt when someone is hired or leaves.

### 2. Three people hold positions at both campuses

- **Zach Woodall** — Students co-lead (Holly Springs) *and* Campus Pastor (Union Hill)
- **John Booth** — Production (Holly Springs) *and* Production Director (Union Hill)
- **Charlie Shultz** — Facilities (Holly Springs) *and* Facilities Director (Union Hill)

This is exactly who the campus toggle is for. A person-to-campus field would
have forced each of them to pick one; a person-to-position link doesn't.

### 3. Two boxes hold two people each

"Zach & Sarah Woodall" over Students, and "John Booth & Josh Floyd" over
Production. Both are one position with two holders, so each person still gets
their own login while the chart shows the shared role.

## Two reporting lines that break the pattern

Worth knowing these aren't mistakes in the data — they're what the chart says:

- **Union Hill Production Director (John Booth)** reports to **Thomas Davis
  (Worship)**, not to Holly Springs Production. Production rolls under Worship
  at Union Hill.
- **Union Hill Facilities Director (Charlie Shultz)** reports to **JB Kitts**
  directly, skipping the Holly Springs Facilities head.

## Open items

**Emails**

- Only `zach@newlifecanton.com` is on file. `people.email` is nullable, so the
  other 14 exist in the chart and the org tree without logins; each gets access
  when their address is added. Not a blocker for anything but their own sign-in.

**Worth confirming (transcribed exactly as printed)**

- "Vannessa Smith" — two n's, as shown on the chart
- "Charlie Shultz" — no 'c', as shown on the chart
- "Roumar Bromfield"
- **"Anna"** (Kids intern) — no last name on the chart

**Decisions pending**

- **Next Steps Director** reads "REPORTS TO: Unassigned." Currently stored with
  no supervisor. Who should own it?
- **Elder Board** sits lateral to the Senior Pastor on both charts. Stored under
  `advisory` and left out of the staff tree for now, since it isn't a department
  and wouldn't hold tasks.
**Resolved**

- **Campus pastors may assign to anyone at their campus** (confirmed
  2026-10-05), on top of the normal downward-only rule. Without this, the Union
  Hill campus pastor couldn't assign to his own directors, since they report to
  Holly Springs department heads. Implemented as a `campus_lead` flag on the
  position; the rule is scoped to that campus, so it grants nothing at the other
  campus and never reaches upward. Logic in [src/lib/org.ts](src/lib/org.ts),
  covered by tests in `src/lib/org.test.ts`.
