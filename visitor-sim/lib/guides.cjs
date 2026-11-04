'use strict'
/**
 * Generic Pendo guide / resource-center handling (the script half of the hybrid run).
 *
 * The Pendo agent injects guides into the host page's DOM. We look for the
 * standard Pendo containers, record what we saw, then advance / dismiss / ignore
 * with weighted odds. Anything we cannot classify is reported under
 * `needsAgent` so the supervising agent can look at it (screenshot + html).
 *
 * UNVERIFIED against live guides: the class names below are Pendo's usual ones
 * (`_pendo-*`, `#pendo-guide-container`); the first live run should confirm them.
 */
const { weighted } = require('./util.cjs')

const GUIDE_CONTAINER = '#pendo-guide-container, [id^="pendo-g-"], ._pendo-step-container-styles'
const CLOSE_BUTTON = '._pendo-close-guide, [data-pendo-close], button[aria-label="Close" i]._pendo-button'
const ADVANCE_BUTTON = '._pendo-button[data-pendo-advance], ._pendo-guide-next_, ._pendo-button:not(._pendo-close-guide)'
const RESOURCE_CENTER = '[id^="pendo-resource-center"], ._pendo-resource-center-badge-container'

// Probability weights: advance / dismiss / ignore.
const GUIDE_ODDS = [45, 30, 25]

async function snapshotGuide(page, runDir, tag) {
  const loc = page.locator(GUIDE_CONTAINER).first()
  const shot = `${runDir}/guide-${tag}-${Date.now()}.png`
  await page.screenshot({ path: shot }).catch(() => {})
  const html = (await loc.evaluate((el) => el.outerHTML.slice(0, 1500)).catch(() => '')) || ''
  const text = (await loc.innerText().catch(() => '')).trim().slice(0, 300)
  return { screenshot: shot, text, html }
}

/**
 * Look for a visible guide and act on it. Returns an event for the run log, or null.
 * @param {import('playwright').Page} page
 */
async function handleGuides(page, { rng, runDir, log, fast }) {
  const guide = page.locator(GUIDE_CONTAINER).first()
  if (!(await guide.isVisible().catch(() => false))) return null

  const seen = await snapshotGuide(page, runDir, 'seen')
  const choice = weighted(rng, ['advance', 'dismiss', 'ignore'], GUIDE_ODDS)
  const event = { type: 'guide', choice, text: seen.text, screenshot: seen.screenshot }

  try {
    if (choice === 'advance') {
      const btn = guide.locator(ADVANCE_BUTTON).first()
      if (await btn.isVisible().catch(() => false)) await btn.click({ timeout: 3000 })
      else { event.choice = 'advance-failed'; event.needsAgent = 'no advance button found'; event.html = seen.html }
    } else if (choice === 'dismiss') {
      const btn = guide.locator(CLOSE_BUTTON).first()
      if (await btn.isVisible().catch(() => false)) await btn.click({ timeout: 3000 })
      else { event.choice = 'dismiss-failed'; event.needsAgent = 'no close button found'; event.html = seen.html }
    }
    await page.waitForTimeout(fast ? 100 : 800)
  } catch (err) {
    event.needsAgent = `guide interaction threw: ${err.message.split('\n')[0]}`
    event.html = seen.html
  }
  log(event)
  return event
}

async function hasResourceCenter(page) {
  return page.locator(RESOURCE_CENTER).first().isVisible().catch(() => false)
}

module.exports = { handleGuides, hasResourceCenter, GUIDE_CONTAINER }
