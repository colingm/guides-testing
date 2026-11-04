'use strict'
/**
 * Generates a fake visitor's signup answers. Every value satisfies the zod
 * step schemas in src/auth/schemas.ts (checked again by validateProfile).
 */
const { randInt, pick, weighted, sample } = require('./util.cjs')

const ROLES = ['Product', 'Engineering', 'Design', 'Marketing', 'Sales', 'Operations', 'Other']
const COMPANY_SIZES = ['1–10', '11–50', '51–200', '201–1,000', '1,000+']
const INDUSTRIES = [
  'Software', 'Financial services', 'Healthcare', 'Retail / e-commerce',
  'Manufacturing', 'Education', 'Other',
]
const PLANS = ['Free', 'Pro', 'Enterprise']
const USE_CASES = [
  'Project management', 'Task tracking', 'Team coordination',
  'Personal productivity', 'Just exploring',
]
const GOALS = [
  'Ship faster', 'Better visibility', 'Less context switching',
  'Cleaner reporting', 'Onboard the team', 'Replace another tool',
]

const TITLES = {
  Product: ['Product Manager', 'Senior Product Manager', 'Product Owner', 'Group Product Manager', 'Director of Product', 'Associate Product Manager'],
  Engineering: ['Software Engineer', 'Senior Software Engineer', 'Engineering Manager', 'Staff Engineer', 'QA Engineer', 'DevOps Engineer'],
  Design: ['Product Designer', 'Senior UX Designer', 'UX Researcher', 'Design Lead', 'Visual Designer'],
  Marketing: ['Marketing Manager', 'Growth Marketer', 'Content Strategist', 'Demand Generation Lead', 'Head of Marketing'],
  Sales: ['Account Executive', 'Sales Development Rep', 'Customer Success Manager', 'Sales Operations Analyst', 'VP of Sales'],
  Operations: ['Operations Manager', 'Program Manager', 'Business Analyst', 'Chief of Staff', 'Project Coordinator'],
  Other: ['Founder', 'Consultant', 'Freelancer', 'Analyst', 'Executive Assistant'],
}
const SENIOR = /(senior|director|head|vp|lead|staff|chief|founder|group|engineering manager|operations manager)/i

const TEAM_SIZE_RANGE = {
  '1–10': [1, 10], '11–50': [3, 25], '51–200': [5, 60],
  '201–1,000': [10, 120], '1,000+': [20, 400],
}

const ascii = (s) => s.normalize('NFKD').replace(/[^A-Za-z0-9]/g, '').toLowerCase()

/**
 * @param {{faker: any, rng: () => number, taken: {emails:Set<string>, usernames:Set<string>, companies:Set<string>}, emailDomain?: string}} ctx
 */
function generateProfile({ faker, rng, taken, emailDomain = 'example.com' }) {
  const firstName = faker.person.firstName()
  const lastName = faker.person.lastName()

  // Unique email + username (the app compares case-insensitively).
  let n = 0
  let email, username
  do {
    const suffix = n === 0 ? '' : String(n + 1)
    email = `${ascii(firstName)}.${ascii(lastName)}${suffix}@${emailDomain}`
    username = `${ascii(firstName)[0] || 'u'}${ascii(lastName)}${suffix}`.slice(0, 24)
    n++
  } while (taken.emails.has(email.toLowerCase()) || taken.usernames.has(username.toLowerCase()))

  const password = `${ascii(faker.word.adjective())}-${ascii(faker.word.noun())}-${randInt(rng, 100, 999)}`

  const role = weighted(rng, ROLES, [26, 24, 10, 10, 12, 12, 6])
  const jobTitle = pick(rng, TITLES[role])
  const yearsExperience = SENIOR.test(jobTitle) ? randInt(rng, 7, 22) : randInt(rng, 0, 9)
  const location = `${faker.location.city()}, ${faker.location.country()}`

  let companyName
  do {
    companyName = faker.company.name()
  } while (taken.companies.has(companyName.toLowerCase()))

  const companySize = weighted(rng, COMPANY_SIZES, [20, 30, 25, 15, 10])
  const industry = weighted(rng, INDUSTRIES, [35, 12, 10, 12, 8, 10, 13])
  const bigCo = companySize === '201–1,000' || companySize === '1,000+'
  const planTier = bigCo
    ? weighted(rng, PLANS, [10, 35, 55])
    : weighted(rng, PLANS, [45, 45, 10])

  const [lo, hi] = TEAM_SIZE_RANGE[companySize]
  const teamSize = randInt(rng, lo, hi)
  const primaryUseCase = weighted(rng, USE_CASES, [30, 25, 25, 8, 12])
  const topGoals = sample(rng, GOALS, randInt(rng, 1, 3))

  taken.emails.add(email.toLowerCase())
  taken.usernames.add(username.toLowerCase())
  taken.companies.add(companyName.toLowerCase())

  const profile = {
    step1: { email, password, firstName, lastName, username },
    step2: { jobTitle, role, yearsExperience, location },
    step3: { companyName, companySize, industry, planTier },
    step4: { primaryUseCase, teamSize, topGoals },
  }
  validateProfile(profile)
  return profile
}

/** Mirrors src/auth/schemas.ts. Throws with a readable message on drift. */
function validateProfile(p) {
  const fail = (m) => { throw new Error(`Invalid generated profile: ${m}`) }
  const s1 = p.step1, s2 = p.step2, s3 = p.step3, s4 = p.step4
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s1.email)) fail('email')
  if (s1.password.length < 8) fail('password length')
  if (!s1.firstName || !s1.lastName) fail('name')
  if (!/^[a-zA-Z0-9_-]+$/.test(s1.username)) fail('username')
  if (!s2.jobTitle || !ROLES.includes(s2.role) || !s2.location) fail('step2')
  if (!Number.isInteger(s2.yearsExperience) || s2.yearsExperience < 0 || s2.yearsExperience > 60) fail('years')
  if (!s3.companyName || !COMPANY_SIZES.includes(s3.companySize) || !INDUSTRIES.includes(s3.industry) || !PLANS.includes(s3.planTier)) fail('step3')
  if (!USE_CASES.includes(s4.primaryUseCase)) fail('use case')
  if (!Number.isInteger(s4.teamSize) || s4.teamSize < 1 || s4.teamSize > 10000) fail('team size')
  if (s4.topGoals.length < 1 || s4.topGoals.length > 3 || s4.topGoals.some((g) => !GOALS.includes(g))) fail('goals')
}

function takenFromRoster(roster) {
  const taken = { emails: new Set(), usernames: new Set(), companies: new Set() }
  for (const e of roster) {
    taken.emails.add(e.profile.step1.email.toLowerCase())
    taken.usernames.add(e.profile.step1.username.toLowerCase())
    taken.companies.add(e.profile.step3.companyName.toLowerCase())
  }
  return taken
}

module.exports = { generateProfile, validateProfile, takenFromRoster, ROLES, COMPANY_SIZES, INDUSTRIES, PLANS, USE_CASES, GOALS }
