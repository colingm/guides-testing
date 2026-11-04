#!/usr/bin/env node
'use strict'
/**
 * Moves the roster in and out of a scheduled task's prompt.
 *
 *   node bin/roster-cli.cjs compact          # print the roster as one line of JSON (paste into the prompt)
 *   node bin/roster-cli.cjs import < roster.json   # validate stdin and write data/visitors.json
 *   node bin/roster-cli.cjs summary          # one line per visitor
 */
const fs = require('node:fs')
const { parseArgs } = require('../lib/args.cjs')
const { loadRoster, saveRoster, DEFAULT_PATH } = require('../lib/roster.cjs')
const { validateProfile } = require('../lib/profile.cjs')

function validate(roster) {
  if (roster.version !== 1 || !Array.isArray(roster.visitors)) throw new Error('not a version-1 roster')
  const emails = new Set(), ids = new Set()
  for (const e of roster.visitors) {
    validateProfile(e.profile)
    for (const k of ['visitorId', 'workspaceId', 'visitorCreatedAt', 'workspaceCreatedAt']) {
      if (!e.identity || !e.identity[k]) throw new Error(`${e.profile.step1.email}: missing identity.${k}`)
    }
    const email = e.profile.step1.email.toLowerCase()
    if (emails.has(email) || ids.has(e.identity.visitorId)) throw new Error(`duplicate visitor ${email}`)
    emails.add(email); ids.add(e.identity.visitorId)
  }
}

const [cmd] = process.argv.slice(2)
const file = parseArgs(process.argv).roster || DEFAULT_PATH
if (cmd === 'compact') {
  const roster = loadRoster(file); validate(roster)
  process.stdout.write(JSON.stringify(roster) + '\n')
} else if (cmd === 'import') {
  const roster = JSON.parse(fs.readFileSync(0, 'utf8')); validate(roster)
  saveRoster(roster, file)
  console.log(`wrote ${roster.visitors.length} visitors to ${file}`)
} else if (cmd === 'summary') {
  const roster = loadRoster(file); validate(roster)
  for (const e of roster.visitors) console.log(`${e.profile.step1.email}  ${e.identity.visitorId}  sessions=${e.stats.sessions}  last=${e.stats.lastActiveAt || '-'}`)
} else {
  console.error('usage: roster-cli.cjs compact|import|summary [--roster file]'); process.exit(1)
}
