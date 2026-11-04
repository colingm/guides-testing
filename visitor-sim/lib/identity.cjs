'use strict'
/**
 * Roster entry <-> the records Halo keeps in localStorage.
 *
 * Halo has no backend: accounts live in `halo:v1:visitors` / `halo:v1:workspaces`
 * (see src/storage/keys.ts, src/auth/schemas.ts). The app generates the visitor
 * and workspace ids (nanoid) at signup. We capture them once from a real signup
 * and re-inject identical records into every future browser, so each simulated
 * person keeps the same Pendo visitor id / account id forever.
 */
const crypto = require('node:crypto')

const KEYS = {
  visitors: 'halo:v1:visitors',
  workspaces: 'halo:v1:workspaces',
}

/** Same algorithm as src/auth/passwordHash.ts: SHA-256 of the UTF-8 password, hex. */
const hashPassword = (pw) => crypto.createHash('sha256').update(pw, 'utf8').digest('hex')

function toVisitorRecord(entry) {
  const { step1, step2, step4 } = entry.profile
  return {
    id: entry.identity.visitorId,
    email: step1.email,
    passwordHash: hashPassword(step1.password),
    firstName: step1.firstName,
    lastName: step1.lastName,
    username: step1.username,
    jobTitle: step2.jobTitle,
    role: step2.role,
    yearsExperience: step2.yearsExperience,
    location: step2.location,
    primaryUseCase: step4.primaryUseCase,
    teamSize: step4.teamSize,
    topGoals: step4.topGoals,
    createdAt: entry.identity.visitorCreatedAt,
  }
}

function toWorkspaceRecord(entry) {
  const { step3 } = entry.profile
  return {
    id: entry.identity.workspaceId,
    ownerVisitorId: entry.identity.visitorId,
    companyName: step3.companyName,
    companySize: step3.companySize,
    industry: step3.industry,
    planTier: step3.planTier,
    createdAt: entry.identity.workspaceCreatedAt,
  }
}

function buildSeed(roster) {
  return {
    visitors: roster.map(toVisitorRecord),
    workspaces: roster.map(toWorkspaceRecord),
  }
}

/**
 * Reads the account the app just created out of localStorage and checks that it
 * matches what we typed into the forms (so a form/selector regression is loud).
 */
async function captureIdentity(page, profile) {
  const raw = await page.evaluate(([vk, wk]) => ({
    visitors: JSON.parse(localStorage.getItem(vk) || '[]'),
    workspaces: JSON.parse(localStorage.getItem(wk) || '[]'),
  }), [KEYS.visitors, KEYS.workspaces])

  const email = profile.step1.email.toLowerCase()
  const visitor = raw.visitors.find((v) => v.email.toLowerCase() === email)
  if (!visitor) throw new Error(`Signup finished but no visitor with email ${email} is in localStorage`)
  const workspace = raw.workspaces.find((w) => w.ownerVisitorId === visitor.id)
  if (!workspace) throw new Error(`No workspace owned by visitor ${visitor.id}`)

  const { step1, step2, step3, step4 } = profile
  const expected = {
    firstName: step1.firstName, lastName: step1.lastName, username: step1.username,
    jobTitle: step2.jobTitle, role: step2.role, yearsExperience: step2.yearsExperience, location: step2.location,
    primaryUseCase: step4.primaryUseCase, teamSize: step4.teamSize,
    passwordHash: hashPassword(step1.password),
  }
  const mismatches = Object.entries(expected).filter(([k, v]) => visitor[k] !== v)
  if (JSON.stringify([...visitor.topGoals].sort()) !== JSON.stringify([...step4.topGoals].sort())) {
    mismatches.push(['topGoals', visitor.topGoals])
  }
  for (const k of ['companyName', 'companySize', 'industry', 'planTier']) {
    if (workspace[k] !== step3[k]) mismatches.push([k, workspace[k]])
  }
  if (mismatches.length) {
    throw new Error(`Stored account differs from the form values: ${JSON.stringify(mismatches)}`)
  }

  return {
    visitorId: visitor.id,
    workspaceId: workspace.id,
    visitorCreatedAt: visitor.createdAt,
    workspaceCreatedAt: workspace.createdAt,
  }
}

module.exports = { KEYS, hashPassword, toVisitorRecord, toWorkspaceRecord, buildSeed, captureIdentity }
