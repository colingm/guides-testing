#!/usr/bin/env node
'use strict'
/**
 * Creates fake visitors by driving the real signup wizard, and records both the
 * answers typed into the forms and the ids the app generated.
 *
 *   node bin/generate-roster.cjs --base-url http://localhost:3030/ --count 20
 *
 * Re-running adds up to --count TOTAL visitors (it tops the roster up), so it is
 * safe to resume after a failure.
 */
const { faker } = require('@faker-js/faker')
const { parseArgs } = require('../lib/args.cjs')
const { mulberry32 } = require('../lib/util.cjs')
const { generateProfile, takenFromRoster } = require('../lib/profile.cjs')
const { loadRoster, saveRoster, newEntry, DEFAULT_PATH } = require('../lib/roster.cjs')
const { launch, newVisitorContext } = require('../lib/browser.cjs')
const { signUp } = require('../lib/flows.cjs')

async function createVisitor({ browser, baseUrl, roster, faker, rng, emailDomain }) {
  const profile = generateProfile({ faker, rng, taken: takenFromRoster(roster.visitors), emailDomain })
  const { context, page } = await newVisitorContext(browser, roster.visitors)
  try {
    const identity = await signUp(page, baseUrl, profile)
    return newEntry(profile, identity)
  } catch (err) {
    const shot = `out/signup-failure-${Date.now()}.png`
    await page.screenshot({ path: shot }).catch(() => {})
    err.message += ` | url=${page.url()} | screenshot=${shot}`
    throw err
  } finally {
    await context.close()
  }
}

async function main() {
  const args = parseArgs(process.argv)
  const baseUrl = args['base-url'] || process.env.HALO_BASE_URL
  if (!baseUrl) throw new Error('Pass --base-url (e.g. http://localhost:3030/ or https://colingm.github.io/guides-testing/)')
  const target = Number(args.count ?? 20)
  const file = args.roster || DEFAULT_PATH
  const seed = Number(args.seed ?? Date.now() % 2 ** 31)
  faker.seed(seed)
  const rng = mulberry32(seed)

  const roster = loadRoster(file)
  console.log(`roster: ${roster.visitors.length}/${target} visitors (seed ${seed}) -> ${file}`)

  const browser = await launch({ headed: Boolean(args.headed) })
  let failures = 0
  try {
    while (roster.visitors.length < target && failures < 5) {
      try {
        const entry = await createVisitor({ browser, baseUrl, roster, faker, rng, emailDomain: args['email-domain'] })
        roster.visitors.push(entry)
        saveRoster(roster, file)
        const p = entry.profile
        console.log(`  + ${roster.visitors.length}/${target} ${p.step1.email} (${p.step2.role}, ${p.step3.companyName}, ${p.step3.planTier})`)
      } catch (err) {
        failures++
        console.error(`  ! signup failed (${failures}/5): ${err.message.split("\n").slice(0, 6).join(" | ")}`)
      }
    }
  } finally {
    await browser.close()
  }
  if (roster.visitors.length < target) process.exitCode = 1
}

main().catch((e) => { console.error(e); process.exit(1) })
