'use strict'

/** Small deterministic PRNG so a run can be reproduced with --seed. */
function mulberry32(seed) {
  let a = seed >>> 0
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const randInt = (rng, min, max) => min + Math.floor(rng() * (max - min + 1))
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)]
const chance = (rng, p) => rng() < p

function weighted(rng, options, weights) {
  const total = weights.reduce((a, b) => a + b, 0)
  let r = rng() * total
  for (let i = 0; i < options.length; i++) {
    r -= weights[i]
    if (r <= 0) return options[i]
  }
  return options[options.length - 1]
}

function shuffle(rng, arr) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Pick `n` distinct items. */
const sample = (rng, arr, n) => shuffle(rng, arr).slice(0, n)

/** CSS selector for a Halo `data-pendo-id` hook (see src/pendo/PENDO_IDS.ts). */
const sel = (id) => `[data-pendo-id="${id}"]`

/** Base URLs must end in "/" so new URL('signin', base) keeps a sub-path like /guides-testing/. */
function normalizeBase(base) {
  return base.endsWith('/') ? base : base + '/'
}
const appUrl = (base, path) => new URL(path.replace(/^\//, ''), normalizeBase(base)).toString()

/** Stable 32-bit hash of a string, used to give each visitor a fixed "engagement" persona. */
function hashString(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

module.exports = {
  mulberry32, randInt, pick, chance, weighted, shuffle, sample,
  sel, normalizeBase, appUrl, hashString,
}
