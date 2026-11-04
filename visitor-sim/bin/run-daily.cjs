#!/usr/bin/env node
'use strict'
/**
 * One day of simulated activity.
 *
 *   node bin/run-daily.cjs --base-url https://colingm.github.io/guides-testing/
 *
 * - picks 5–10 random roster visitors (or --count N / --only email,email)
 * - for each: fresh browser, roster accounts injected, REAL sign-in form, activity, sign out
 * - with ~10% probability (or --new / --no-new) also creates one brand-new visitor through
 *   the signup wizard and appends them to the roster
 * - writes out/report-<timestamp>.json and prints a summary; exit code 2 if any sign-in failed
 */
const fs = require('node:fs')
const path = require('node:path')
const { faker } = require('@faker-js/faker')
const { parseArgs } = require('../lib/args.cjs')
const { mulberry32, randInt, chance, shuffle } = require('../lib/util.cjs')
const { generateProfile, takenFromRoster } = require('../lib/profile.cjs')
const { loadRoster, saveRoster, newEntry, DEFAULT_PATH } = require('../lib/roster.cjs')
const { launch, newVisitorContext } = require('../lib/browser.cjs')
const { signUp, signIn, signOut } = require('../lib/flows.cjs')
const { runSession } = require('../lib/activity.cjs')

async function visitorSession({ browser, baseUrl, roster, entry, via, ctxBase }) {
  const { step1 } = entry.profile
  const record = { email: step1.email, visitorId: entry.identity.visitorId, workspaceId: entry.identity.workspaceId, via, signedIn: false }
  const { context, page } = await newVisitorContext(browser, roster.visitors)
  const guideEvents = []
  const ctx = { ...ctxBase, page, log: (e) => guideEvents.push(e) }
  try {
    if (via === 'signin') {
      record.signedIn = await signIn(page, baseUrl, step1.email, step1.password)
      if (!record.signedIn) {
        record.error = 'sign-in rejected (credentials or injected account mismatch)'
        record.screenshot = path.join(ctxBase.runDir, `signin-failed-${Date.now()}.png`)
        await page.screenshot({ path: record.screenshot }).catch(() => {})
        return record
      }
    } else {
      record.signedIn = true // signup already signed them in
    }
    const session = await runSession(ctx, entry.identity.visitorId)
    Object.assign(record, session)
    await signOut(page).catch((e) => { record.signOutError = e.message.split('\n')[0] })
  } catch (err) {
    record.error = err.message.split('\n')[0]
  } finally {
    record.guides = guideEvents
    await context.close()
  }
  return record
}

async function main() {
  const args = parseArgs(process.argv)
  const baseUrl = args['base-url'] || process.env.HALO_BASE_URL
  if (!baseUrl) throw new Error('Pass --base-url (or HALO_BASE_URL)')
  const file = args.roster || DEFAULT_PATH
  const seed = Number(args.seed ?? Date.now() % 2 ** 31)
  const rng = mulberry32(seed)
  faker.seed(seed)

  const roster = loadRoster(file)
  if (roster.visitors.length === 0) throw new Error(`Roster ${file} is empty — run bin/generate-roster.cjs first`)

  const startedAt = new Date()
  const runDir = path.join(__dirname, '..', 'out', `run-${startedAt.toISOString().replace(/[:.]/g, '-')}`)
  fs.mkdirSync(runDir, { recursive: true })

  let chosen
  if (args.only) {
    const wanted = String(args.only).split(',').map((s) => s.trim().toLowerCase())
    chosen = roster.visitors.filter((e) => wanted.includes(e.profile.step1.email.toLowerCase()))
  } else {
    const count = Math.min(Number(args.count ?? randInt(rng, 5, 10)), roster.visitors.length)
    chosen = shuffle(rng, roster.visitors).slice(0, count)
  }
  const newChance = Number(args['new-chance'] ?? 0.1)
  const createNew = args['no-new'] ? false : args.new ? true : chance(rng, newChance)

  const ctxBase = { rng, faker, fast: Boolean(args.fast), runDir }
  const report = { startedAt: startedAt.toISOString(), baseUrl, seed, rosterSize: roster.visitors.length, sessions: [], newVisitor: null }
  console.log(`run: ${chosen.length} visitors${createNew ? ' + 1 new' : ''} (seed ${seed}) -> ${baseUrl}`)

  const browser = await launch({ headed: Boolean(args.headed) })
  try {
    for (const entry of chosen) {
      const rec = await visitorSession({ browser, baseUrl, roster, entry, via: 'signin', ctxBase })
      report.sessions.push(rec)
      if (rec.signedIn) {
        entry.stats.sessions += 1
        entry.stats.lastActiveAt = new Date().toISOString()
      }
      const ok = (rec.results || []).filter((r) => r.ok).length
      const bad = (rec.results || []).length - ok
      console.log(`  ${rec.signedIn ? '✓' : '✗'} ${rec.email} [${rec.persona || '-'}] ${ok} ok / ${bad} failed${rec.error ? ' — ' + rec.error : ''}`)
      saveRoster(roster, file)
    }

    if (createNew) {
      const profile = generateProfile({ faker, rng, taken: takenFromRoster(roster.visitors), emailDomain: args['email-domain'] })
      const { context, page } = await newVisitorContext(browser, roster.visitors)
      try {
        const identity = await signUp(page, baseUrl, profile)
        const entry = newEntry(profile, identity)
        await context.close()
        roster.visitors.push(entry)
        saveRoster(roster, file)
        report.newVisitor = { email: profile.step1.email, visitorId: identity.visitorId, workspaceId: identity.workspaceId }
        console.log(`  + new visitor ${profile.step1.email}`)
        // Their first session happens right after signup, in a fresh browser via real sign-in.
        const rec = await visitorSession({ browser, baseUrl, roster, entry, via: 'signin', ctxBase })
        report.sessions.push(rec)
        entry.stats.sessions += 1
        entry.stats.lastActiveAt = new Date().toISOString()
        saveRoster(roster, file)
      } catch (err) {
        report.newVisitor = { error: err.message.split('\n')[0] }
        console.error(`  ! new-visitor signup failed: ${report.newVisitor.error}`)
        await context.close().catch(() => {})
      }
    }
  } finally {
    await browser.close()
  }

  report.finishedAt = new Date().toISOString()
  report.rosterSizeAfter = roster.visitors.length
  report.needsAgent = report.sessions.flatMap((s) => [
    ...(s.guides || []).filter((g) => g.needsAgent).map((g) => ({ email: s.email, ...g })),
    ...(s.signedIn ? [] : [{ email: s.email, issue: s.error, screenshot: s.screenshot }]),
  ])
  const reportFile = path.join(runDir, 'report.json')
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2))
  const failedSignIns = report.sessions.filter((s) => !s.signedIn).length
  const actionFails = report.sessions.reduce((n, s) => n + (s.results || []).filter((r) => !r.ok).length, 0)
  const guidesSeen = report.sessions.reduce((n, s) => n + (s.guides || []).length, 0)
  console.log(`done: ${report.sessions.length} sessions, ${failedSignIns} sign-in failures, ${actionFails} action failures, ${guidesSeen} guides seen, ${report.needsAgent.length} need agent attention`)
  console.log(`report: ${reportFile}`)
  if (failedSignIns > 0) process.exitCode = 2
}

main().catch((e) => { console.error(e); process.exit(1) })
