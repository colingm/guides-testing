'use strict'
/** The real UI flows: signup wizard, sign in, sign out. Selectors use data-pendo-id hooks. */
const { sel, appUrl } = require('./util.cjs')
const { captureIdentity } = require('./identity.cjs')

/** Open a Mantine Select, then click the option with this exact label. */
async function chooseOption(page, selector, label) {
  await page.locator(selector).click()
  await page.getByRole('option', { name: label, exact: true }).click()
}

/** Open a Select and click a random option; returns its label. */
async function chooseRandomOption(page, selector, rng) {
  const input = page.locator(selector)
  // A MultiSelect whose pills fill the field has no clickable input area: focus opens it instead.
  await input.click({ timeout: 2500 }).catch(() => input.focus())
  const options = page.getByRole('option')
  await options.first().waitFor({ state: 'visible' })
  const i = Math.floor(rng() * (await options.count()))
  const label = (await options.nth(i).innerText()).trim()
  await options.nth(i).click()
  return label
}

/** Drives /signup → /signup/details → /company → /preferences. Returns the captured identity. */
async function signUp(page, baseUrl, profile) {
  const { step1, step2, step3, step4 } = profile
  await page.goto(appUrl(baseUrl, 'signup'), { waitUntil: 'domcontentloaded' })

  await page.locator(sel('signup.step1.email')).fill(step1.email)
  await page.locator(sel('signup.step1.password')).fill(step1.password)
  await page.locator(sel('signup.step1.first-name')).fill(step1.firstName)
  await page.locator(sel('signup.step1.last-name')).fill(step1.lastName)
  await page.locator(sel('signup.step1.username')).fill(step1.username)
  await page.locator(sel('signup.step1.submit')).click()
  await page.waitForURL(/\/signup\/details\/?$/)

  await page.locator(sel('signup.step2.job-title')).fill(step2.jobTitle)
  await chooseOption(page, sel('signup.step2.role'), step2.role)
  await page.locator(sel('signup.step2.years-experience')).fill(String(step2.yearsExperience))
  await page.locator(sel('signup.step2.location')).fill(step2.location)
  await page.locator(sel('signup.step2.submit')).click()
  await page.waitForURL(/\/signup\/company\/?$/)

  await page.locator(sel('signup.step3.company-name')).fill(step3.companyName)
  await chooseOption(page, sel('signup.step3.company-size'), step3.companySize)
  await chooseOption(page, sel('signup.step3.industry'), step3.industry)
  await chooseOption(page, sel('signup.step3.plan-tier'), step3.planTier)
  await page.locator(sel('signup.step3.submit')).click()
  await page.waitForURL(/\/signup\/preferences\/?$/)

  await chooseOption(page, sel('signup.step4.use-case'), step4.primaryUseCase)
  await page.locator(sel('signup.step4.team-size')).fill(String(step4.teamSize))
  for (const goal of step4.topGoals) {
    // The dropdown can stay open after a pick; clicking the input again would close it.
    const option = page.getByRole('option', { name: goal, exact: true })
    if (!(await option.isVisible())) await page.locator(sel('signup.step4.goals')).click()
    await option.click()
  }
  await page.keyboard.press('Escape')
  await page.locator(sel('signup.step4.submit')).click()
  await page.waitForURL(/\/app\/?$/)

  return captureIdentity(page, profile)
}

/** Signs in through /signin. Returns true on success, false on the "don't match" alert. */
async function signIn(page, baseUrl, email, password) {
  await page.goto(appUrl(baseUrl, 'signin'), { waitUntil: 'domcontentloaded' })
  await page.locator(sel('signin.email')).fill(email)
  await page.locator(sel('signin.password')).fill(password)
  await page.locator(sel('signin.submit')).click()
  try {
    await page.waitForURL(/\/app\/?$/, { timeout: 10000 })
    return true
  } catch {
    return false
  }
}

async function signOut(page) {
  await page.locator(sel('topbar.user-menu.button')).click()
  await page.locator(sel('topbar.user-menu.sign-out')).click()
  await page.waitForURL((u) => !/\/app(\/|$)/.test(u.pathname))
}

module.exports = { signUp, signIn, signOut, chooseOption, chooseRandomOption }
