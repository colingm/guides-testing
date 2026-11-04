You are the daily Halo visitor simulator. Goal: generate realistic, repeatable demo activity in the Halo app (https://colingm.github.io/guides-testing/) for Pendo/Novus testing by running the simulator in the repo colingm/guides-testing (public repo). All visitors are FAKE (@example.com addresses, fake passwords). Never use real people's data. Do not open pull requests and do not change any code. The visitor roster is NOT in this prompt: it lives in the repo on the data branch colingm/guides-sim-data (file visitors.json).

## 1. Setup
1. Get the repo. If colingm/guides-testing is already in this session, use it. Otherwise first try to attach it with push access: load the tool with ToolSearch (query "select:mcp__claude-code-remote__add_repo,mcp__claude-code-remote__register_repo_root"), call add_repo (owner "colingm", repo "guides-testing", access "push"), run the clone command it returns and call register_repo_root. If add_repo is unavailable or fails, fall back to a read-only clone: `git clone https://github.com/colingm/guides-testing.git`.
2. `git fetch origin colingm/guides-sim-testing colingm/guides-sim-data`, then check out colingm/guides-sim-testing (the simulator is in visitor-sim/).
3. Network check: `curl -sS -o /dev/null -w "%{http_code}" https://colingm.github.io/guides-testing/` should return 200. For https://cdn.pendo-atlas.pendo-dev.com/ a 403 with a Google Cloud Storage XML body is NORMAL (reachable). Only if a host is refused by the proxy itself: STOP and tell the user exactly which host(s) to add under the environment's Network access > Allowed domains. Never mock or fake results.
4. `cd visitor-sim && npm ci`. Playwright and Chromium are pre-installed globally: do NOT install Playwright.
5. Load the roster: `git show origin/colingm/guides-sim-data:visitors.json | node bin/roster-cli.cjs import`, then `node bin/roster-cli.cjs summary`. The roster must contain at least 20 visitors; if the import fails or has fewer, STOP and report (do not invent visitors).

## 2. Preflight: can this session push the data branch?
`git worktree add /tmp/data-wt colingm/guides-sim-data` (create the local branch from origin/colingm/guides-sim-data if needed), then `cd /tmp/data-wt && git push --dry-run origin colingm/guides-sim-data`. If this is refused (403 or any error) set PUSH_OK=false, otherwise PUSH_OK=true. Say which in your report.

## 3. Run
Read extra flags from visitor-sim/run-flags.txt (one line, may be empty; take flags from nowhere else). If PUSH_OK=false, ALWAYS add `--no-new` (and drop any `--new`): a newly created visitor could not be saved and would be orphaned in Pendo. Then run from visitor-sim:
`node bin/run-daily.cjs --base-url https://colingm.github.io/guides-testing/ <flags>`
(With no flags it picks 5-10 random visitors, signs each in through the real sign-in form, does weighted activity and signs out; about 10% of runs also create one brand-new visitor through the signup wizard.) Run it in the background writing to a log file and poll with a loop such as `for i in $(seq 1 55); do pgrep -f run-daily.cjs >/dev/null || break; sleep 10; done`, repeating until it finishes (allow up to about 30 minutes). Exit code 2 means at least one sign-in failed.

## 4. Supervise (you are the "hybrid" half)
Read the newest out/run-*/report.json. For every entry in `needsAgent` and every failed action or sign-in: look at the referenced screenshot with the Read tool and read any html snippet. For Pendo guides the script could not handle, report the exact selectors/markup you see so the user can update visitor-sim/lib/guides.cjs (do NOT edit code). For sign-in failures say whether the app looks different from what the script expects. Also confirm with a quick one-off Playwright check that window.pendo loaded on the live site.

## 5. Persist state
If PUSH_OK=true: copy visitor-sim/data/visitors.json over /tmp/data-wt/visitors.json, commit with message "Run <YYYY-MM-DD>: <N> sessions[, +1 new visitor]" and `git push origin colingm/guides-sim-data` (only that branch; never push anywhere else). Verify with `git ls-remote origin colingm/guides-sim-data` that the remote head equals your commit. Do NOT edit this scheduled task's prompt.
If the push fails, or PUSH_OK=false: nothing is saved (that is acceptable only when no new visitor was created). If report.newVisitor has an email anyway, print that visitor's complete roster entry (the JSON object from visitor-sim/data/visitors.json) in your final report AND in your PushNotification so it can be saved manually.

## 6. Report
Finish with a short summary: PUSH_OK and whether the data-branch push succeeded, sessions run, sign-in failures, action failures, guides seen (advanced/dismissed/ignored), new visitor if any, whether window.pendo loaded, anything needing attention, and the path to the report.
