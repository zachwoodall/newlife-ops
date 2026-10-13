# Staff profiles — planned

Captured 12 October 2026. Not started.

Reference: [leadr.com](https://leadr.com) was named as a good example of
what this should feel like.

## What it is for

Each person gets a profile, tied to their account, that helps the rest of the
team work with them well. Two halves:

**Who they are.** A photo, fun facts, favourite food, hobbies. The human part.

**How they work.** Their results from several assessments, and what those
results mean in practice -- how to work with them, how not to, what motivates
them, what drains them.

## The assessments

Five, and they are not the same shape as each other:

| Assessment | Shape of a result |
| --- | --- |
| Enneagram | A number 1-9, usually with a wing (e.g. 3w2) |
| Myers-Briggs | Four letters (e.g. ENFJ) |
| Working Genius | Two geniuses, two competencies, two frustrations |
| DISC | A profile, often a primary and secondary letter |
| Motivational gifts | New Life's own -- definitions needed from Zach |

Each result should carry:

- the result itself
- a description of that type
- ways to work with them
- ways *not* to work with them
- what motivates them
- what demotivates them

## Questions to settle before building

These change the schema, so they are worth deciding first rather than
discovering halfway through.

**Is the description per type, or per person?** A canned description of
"ENFJ" is the same for everyone who is one, and could be stored once. But the
useful sentence is usually the person's own -- "I process out loud, so don't
read my first reaction as a decision." Likely both: a stock description per
type, plus the person's own notes. The stock text has to come from somewhere;
whether we can use published descriptions needs checking, since several of
these are trademarked instruments.

**Who can see a profile?** Probably all staff -- the point is working together
-- but worth confirming. Personality results are personal, and someone may
reasonably not want theirs visible.

**Who can edit one?** Self only is the obvious answer. Administrators
probably need to be able to fix a photo or remove something, but should not be
quietly editing someone's self-description.

**Is any of it required?** Suggest not. A blank profile should look
deliberate, not broken.

**Motivational gifts needs defining.** It is New Life's own assessment, so
its types, their descriptions and the working-with guidance all have to come
from Zach before it can be built.

## Likely shape

Roughly: a `profiles` table one-to-one with `people` for the human part, and
an `assessment_results` table keyed by person and framework, so a new
framework is a row rather than a migration. Photos reuse the existing
ImageKit upload path.

Nothing here is decided.
