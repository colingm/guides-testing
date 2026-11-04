'use strict'
/**
 * What a signed-in visitor does. Each action is small, self-contained and
 * wrapped so one failing action never aborts the session.
 */
const { sel, randInt, pick, chance, weighted, hashString } = require('./util.cjs')
const { chooseRandomOption } = require('./flows.cjs')
const { handleGuides } = require('./guides.cjs')

const NAV = { dashboard: 'nav.dashboard', lists: 'nav.lists', reports: 'nav.reports', team: 'nav.team', settings: 'nav.settings', help: 'nav.help' }
const HELP_QUERIES = ['task', 'team', 'report', 'export', 'password', 'workspace', 'invite', 'filter']

/** Stable per-visitor persona so some people are heavy users and others barely show up. */
function personaFor(visitorId) {
  const h = hashString(visitorId) % 100
  if (h < 25) return { name: 'power', actions: [8, 14], dwell: [1500, 5000] }
  if (h < 75) return { name: 'regular', actions: [4, 8], dwell: [1200, 4000] }
  return { name: 'light', actions: [2, 4], dwell: [1000, 3000] }
}

/** Task rows appear after the app's seed effect runs; wait briefly rather than assuming. */
async function waitForRows(page, id) {
  await page.locator(sel(id)).first().waitFor({ timeout: 4000 }).catch(() => {})
}

async function goTo(ctx, key) {
  const { page } = ctx
  await page.locator(sel(NAV[key])).click()
  await page.waitForURL(key === 'dashboard' ? /\/app\/?$/ : new RegExp(`/app/${key}`))
  await settle(ctx)
}

/** Pause like a human reading the page, then react to any guide that popped up. */
async function settle(ctx, { short = false } = {}) {
  const { page, rng, fast, persona } = ctx
  const [lo, hi] = persona.dwell
  await page.waitForTimeout(fast ? randInt(rng, 40, 120) : short ? randInt(rng, 400, 1000) : randInt(rng, lo, hi))
  await handleGuides(page, ctx)
}

// ---- individual actions -------------------------------------------------

const actions = {
  async browse(ctx) {
    const pages = ['dashboard', 'lists', 'reports', 'team', 'settings', 'help']
    const n = randInt(ctx.rng, 2, 4)
    const visited = []
    for (let i = 0; i < n; i++) {
      const key = pick(ctx.rng, pages)
      await goTo(ctx, key)
      visited.push(key)
    }
    return `visited ${visited.join(' → ')}`
  },

  async dashboardRange(ctx) {
    await goTo(ctx, 'dashboard')
    // Mantine SegmentedControl: the pendo id is on the root, options are <label>s.
    const segments = ctx.page.locator(`${sel('dashboard.time-range')} label`)
    await segments.first().waitFor({ timeout: 4000 }).catch(() => {})
    if ((await segments.count()) === 0) return 'time range control not shown'
    const i = randInt(ctx.rng, 0, (await segments.count()) - 1)
    const label = (await segments.nth(i).innerText()).trim()
    await segments.nth(i).click()
    await settle(ctx)
    return `time range ${label}`
  },

  async createTask(ctx) {
    const { page, rng, faker } = ctx
    await goTo(ctx, 'lists')
    await page.locator(sel('lists.new-task-button')).first().click()
    const title = faker.hacker.phrase().slice(0, 80)
    await page.locator(sel('lists.modal.title')).fill(title)
    if (chance(rng, 0.6)) await page.locator(sel('lists.modal.description')).fill(faker.lorem.sentence())
    await chooseRandomOption(page, sel('lists.modal.priority'), rng)
    await chooseRandomOption(page, sel('lists.modal.status'), rng)
    await page.locator(sel('lists.modal.save')).click()
    await page.locator(sel('lists.modal.title')).waitFor({ state: 'detached' })
    await settle(ctx, { short: true })
    return `created "${title}"`
  },

  async completeTask(ctx) {
    const { page, rng } = ctx
    await goTo(ctx, 'lists')
    await waitForRows(page, 'lists.row.complete-toggle')
    const toggles = page.locator(sel('lists.row.complete-toggle'))
    const count = await toggles.count()
    if (count === 0) return 'no tasks to toggle'
    await toggles.nth(randInt(rng, 0, Math.min(count, 15) - 1)).click({ force: true })
    await settle(ctx, { short: true })
    return 'toggled a task'
  },

  async filterTasks(ctx) {
    const { page, rng } = ctx
    await goTo(ctx, 'lists')
    const field = pick(rng, ['lists.filter.status', 'lists.filter.priority', 'lists.filter.assignee'])
    const label = await chooseRandomOption(page, sel(field), rng)
    await settle(ctx)
    const clear = page.locator(sel('lists.filtered-empty.clear-link'))
    if (await clear.isVisible().catch(() => false)) await clear.click()
    return `filtered ${field.split('.').pop()} = ${label}`
  },

  async editTask(ctx) {
    const { page, rng, faker } = ctx
    await goTo(ctx, 'lists')
    await waitForRows(page, 'lists.row.kebab')
    const kebabs = page.locator(sel('lists.row.kebab'))
    if ((await kebabs.count()) === 0) return 'no tasks to edit'
    await kebabs.nth(randInt(rng, 0, Math.min(await kebabs.count(), 10) - 1)).click()
    await page.locator(sel('lists.row.kebab-edit')).click()
    await page.locator(sel('lists.modal.title')).fill(faker.hacker.phrase().slice(0, 80))
    await chooseRandomOption(page, sel('lists.modal.priority'), rng)
    await page.locator(sel('lists.modal.save')).click()
    await page.locator(sel('lists.modal.title')).waitFor({ state: 'detached' })
    await settle(ctx, { short: true })
    return 'edited a task'
  },

  async deleteTask(ctx) {
    const { page, rng } = ctx
    await goTo(ctx, 'lists')
    await waitForRows(page, 'lists.row.kebab')
    const kebabs = page.locator(sel('lists.row.kebab'))
    if ((await kebabs.count()) === 0) return 'no tasks to delete'
    await kebabs.nth(randInt(rng, 0, Math.min(await kebabs.count(), 10) - 1)).click()
    await page.locator(sel('lists.row.kebab-delete')).click()
    await page.locator(sel('lists.delete-confirm.confirm')).click()
    await settle(ctx, { short: true })
    return 'deleted a task'
  },

  async inviteTeammate(ctx) {
    const { page, rng, faker } = ctx
    await goTo(ctx, 'team')
    await page.locator(sel('team.header.invite-button')).click()
    const email = `${faker.person.firstName()}.${faker.person.lastName()}`.toLowerCase().replace(/[^a-z.]/g, '') + '@example.com'
    await page.locator(sel('team.invite.modal-email')).fill(email)
    await chooseRandomOption(page, sel('team.invite.modal-role'), rng)
    await page.locator(sel('team.invite.modal-submit')).click()
    await page.locator(sel('team.invite.modal-email')).waitFor({ state: 'detached' })
    await settle(ctx, { short: true })
    return `invited ${email}`
  },

  async editProfile(ctx) {
    const { page, faker } = ctx
    await goTo(ctx, 'settings')
    await page.locator(sel('settings.tabs.profile')).click()
    await page.locator(sel('settings.profile.location')).fill(`${faker.location.city()}, ${faker.location.country()}`)
    await page.locator(sel('settings.profile.save')).click()
    await settle(ctx, { short: true })
    return 'saved profile'
  },

  async toggleTheme(ctx) {
    await goTo(ctx, 'settings')
    await ctx.page.locator(sel('settings.tabs.preferences')).click()
    await ctx.page.locator(sel('settings.preferences.theme-toggle')).click()
    await settle(ctx, { short: true })
    return 'toggled theme'
  },

  async viewReports(ctx) {
    const { page, rng } = ctx
    await goTo(ctx, 'reports')
    // Status is a MultiSelect that starts with every status picked (dropdown has nothing to
    // offer), so narrowing it means removing a pill. Assignee is a plain Select.
    if (chance(rng, 0.5)) {
      const label = await chooseRandomOption(page, sel('reports.filter.assignee'), rng)
      await settle(ctx)
      return `reports assignee filter ${label}`
    }
    const pills = page.locator('.mantine-Pill-remove')
    const n = await pills.count()
    if (n > 1) await pills.nth(randInt(rng, 0, n - 1)).click()
    await settle(ctx)
    return 'reports status filter narrowed'
  },

  async exportCsv(ctx) {
    const { page } = ctx
    await goTo(ctx, 'reports')
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 10000 }),
      page.locator(sel('reports.csv-export')).click(),
    ])
    await download.cancel().catch(() => {})
    await settle(ctx, { short: true })
    return `exported ${download.suggestedFilename()}`
  },

  async readHelp(ctx) {
    const { page, rng } = ctx
    await goTo(ctx, 'help')
    if (chance(rng, 0.5)) await page.locator(sel('help.search')).fill(pick(rng, HELP_QUERIES))
    const rows = page.locator(sel('help.article.row'))
    if ((await rows.count()) === 0) return 'help search had no results'
    await rows.nth(randInt(rng, 0, Math.min(await rows.count(), 5) - 1)).click()
    await settle(ctx)
    await page.locator(sel('help.article.detail-back-link')).click().catch(() => {})
    return 'read a help article'
  },
}

// name → weight. Browsing dominates; destructive actions are rare.
const MIX = {
  browse: 20, dashboardRange: 8, createTask: 14, completeTask: 16, filterTasks: 10, editTask: 6,
  deleteTask: 3, inviteTeammate: 5, editProfile: 3, toggleTheme: 2, viewReports: 8, exportCsv: 4, readHelp: 9,
}

/**
 * Runs a persona-sized series of actions for a signed-in visitor.
 * ctx = { page, rng, faker, fast, runDir, log }
 */
async function runSession(ctx, visitorId) {
  const persona = personaFor(visitorId)
  ctx.persona = persona
  const results = []
  await settle(ctx) // landing on the dashboard (and any first-visit guide)

  const total = randInt(ctx.rng, persona.actions[0], persona.actions[1])
  const names = Object.keys(MIX)
  const weights = names.map((n) => MIX[n])
  for (let i = 0; i < total; i++) {
    const name = weighted(ctx.rng, names, weights)
    try {
      const detail = await actions[name](ctx)
      results.push({ action: name, ok: true, detail })
    } catch (err) {
      const shot = `${ctx.runDir}/fail-${name}-${Date.now()}.png`
      await ctx.page.screenshot({ path: shot }).catch(() => {})
      results.push({ action: name, ok: false, error: err.message.split('\n')[0], screenshot: shot, url: ctx.page.url() })
      // Dismiss any modal left open so the next action starts clean.
      await ctx.page.keyboard.press('Escape').catch(() => {})
    }
  }
  return { persona: persona.name, results }
}

module.exports = { runSession, personaFor, actions, MIX }
