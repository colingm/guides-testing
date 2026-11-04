'use strict'
const fs = require('node:fs')
const path = require('node:path')

const DEFAULT_PATH = path.join(__dirname, '..', 'data', 'visitors.json')

function loadRoster(file = DEFAULT_PATH) {
  if (!fs.existsSync(file)) return { version: 1, visitors: [] }
  const data = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (data.version !== 1 || !Array.isArray(data.visitors)) throw new Error(`Unrecognised roster format in ${file}`)
  return data
}

/** Atomic write (temp file + rename) so a crash can't leave a half-written roster. */
function saveRoster(roster, file = DEFAULT_PATH) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(roster, null, 2) + '\n')
  fs.renameSync(tmp, file)
}

function newEntry(profile, identity) {
  return {
    profile,
    identity,
    stats: { createdAt: new Date().toISOString(), sessions: 0, lastActiveAt: null },
  }
}

module.exports = { DEFAULT_PATH, loadRoster, saveRoster, newEntry }
