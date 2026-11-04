# Halo visitor simulator

Generates realistic, repeatable activity for the Halo demo app (Pendo / Novus testing):
a fixed roster of fake visitors who sign in through the real UI, use the app, and
occasionally a brand-new visitor signs up through the real wizard.

Not part of the app build — it lives beside `src/` and has its own `package.json`.

## Why identity is injected

Halo has no backend. Accounts live in one browser's `localStorage`
(`halo:v1:visitors`, `halo:v1:workspaces`) and the visitor / workspace ids are random
nanoids created at signup. A fresh browser each day would therefore be a brand-new
person to Pendo. So:

1. **Signup once** through the real 4-step wizard (`bin/generate-roster.cjs`). The form
   answers *and* the ids the app generated are saved in the roster.
2. **Every later run** writes those same records into a fresh browser's `localStorage`
   before the app loads (`lib/identity.cjs`, `lib/browser.cjs`), then signs in through the
   real `/signin` form. Pendo sees the same visitor id + account (workspace) id forever.

Tasks / teammates are *not* persisted: the app reseeds them on first entry to `/app`.

## Commands

```bash
cd visitor-sim && npm install        # faker only; Playwright is pre-installed globally
```

```bash
# One-time (or top-up): create visitors via the signup wizard
node bin/generate-roster.cjs --base-url http://localhost:3030/ --count 20
```

```bash
# A day of activity: 5–10 random visitors, ~10% chance of one new visitor
node bin/run-daily.cjs --base-url https://colingm.github.io/guides-testing/
```

Useful flags for `run-daily`: `--count N`, `--only a@x.com,b@x.com`, `--new` / `--no-new`,
`--new-chance 0.1`, `--seed N` (reproducible choices), `--fast` (no human-like pauses),
`--headed`, `--roster path`.

Output: `out/run-<timestamp>/report.json` (+ failure and guide screenshots). Exit code 2 means at
least one sign-in failed.

## Roster format & storage

`data/visitors.json` — `{ version: 1, visitors: [{ profile: {step1..step4}, identity: {visitorId, workspaceId, ...}, stats }] }`.
It contains fake plaintext passwords and is git-ignored on the code branch. The source of
truth is `visitors.json` on the `colingm/guides-sim-data` branch (the scheduled task's prompt no
longer carries the roster, to keep it small). The scheduled agent reads it from there, and pushes
the updated roster back after each run when it has push access. When it can't push, it runs with
`--no-new` so no visitor is created that couldn't be saved.

```bash
node bin/roster-cli.cjs compact            # one-line JSON for pasting into the prompt
node bin/roster-cli.cjs import < roster.json   # validate + write data/visitors.json
node bin/roster-cli.cjs summary
```

## Activity mix

Each visitor has a stable persona (power / regular / light, from a hash of their id) setting how many
actions they take. Actions are weighted: browsing, task create/complete/filter/edit/delete, dashboard
range, reports filter + CSV export, team invite, profile edit, theme toggle, help articles
(`lib/activity.cjs`). Every control is found via its `data-pendo-id` (`src/pendo/PENDO_IDS.ts`).

## Guides (hybrid with the supervising agent)

After each page settles, `lib/guides.cjs` looks for Pendo guide containers and advances (45%), dismisses
(30%) or ignores (25%) them. Anything it cannot handle (no recognisable button, thrown error, failed
sign-in) is listed in `report.needsAgent` with a screenshot and HTML snippet for the agent to deal with.
**The Pendo selectors are unverified against live guides** — confirm on the first real run.

## Run flags for the scheduled agent

`run-flags.txt` holds extra flags the scheduled agent passes to `run-daily.cjs` (one line, may be empty).
It is committed so the flags can be changed with a normal commit instead of editing the routine prompt.
Currently empty = the normal daily mix (5–10 visitors, ~10% chance of one new visitor). For a small safe test run, put `--count 3 --no-new` in it.

## Scheduled-agent prompt

`routine-prompt.md` is a copy of the prompt the scheduled cloud routine runs (keep the two in sync). It is
small because the roster lives on the data branch. If the routine ever has to be recreated, paste this in.
