'use strict'
const { chromium } = require('playwright')
const { buildSeed, KEYS } = require('./identity.cjs')

// A normal desktop Chrome UA: Pendo (and others) may discard "HeadlessChrome" traffic.
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

async function launch({ headed = false } = {}) {
  return chromium.launch({ headless: !headed })
}

/**
 * A fresh, isolated browser context (= one person on one device) whose localStorage
 * is pre-seeded with every roster account. Seeding only happens when the key is
 * absent, so it never overwrites changes the app makes during the session.
 */
async function newVisitorContext(browser, roster, { timezoneId } = {}) {
  const context = await browser.newContext({
    userAgent: USER_AGENT,
    viewport: { width: 1440, height: 900 },
    locale: 'en-US',
    timezoneId,
    acceptDownloads: true,
  })
  const seed = buildSeed(roster)
  await context.addInitScript(
    ({ visitors, workspaces, keys }) => {
      try {
        if (localStorage.getItem(keys.visitors) === null) localStorage.setItem(keys.visitors, JSON.stringify(visitors))
        if (localStorage.getItem(keys.workspaces) === null) localStorage.setItem(keys.workspaces, JSON.stringify(workspaces))
      } catch (_) { /* storage unavailable */ }
    },
    { visitors: seed.visitors, workspaces: seed.workspaces, keys: KEYS },
  )
  const page = await context.newPage()
  page.setDefaultTimeout(15000)
  return { context, page }
}

module.exports = { launch, newVisitorContext, USER_AGENT }
