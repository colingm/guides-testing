/**
 * Pendo Track Event helper.
 *
 * Thin, guarded wrapper around the Pendo agent's `pendo.track(name, props)`.
 * The agent is not yet installed (PendoBridge is a pass-through), so every
 * call no-ops until the snippet defines the `pendo` global. Tracking failures
 * are swallowed and logged — analytics must never break an app flow.
 *
 * Event names are passed verbatim by callers; they match track types already
 * registered in Pendo and MUST NOT be reworded or re-cased.
 *
 * Never pass visitorId / accountId (the agent attaches them) or PII such as
 * emails, passwords, or free-text field values.
 */

export type PendoTrackValue = string | number | boolean | null | string[]

export type PendoTrackProperties = Record<string, PendoTrackValue>

type PendoAgent = {
  track: (eventName: string, properties?: PendoTrackProperties) => void
}

declare global {
  // eslint-disable-next-line no-var
  var pendo: PendoAgent | undefined
}

export function trackEvent(eventName: string, properties: PendoTrackProperties = {}): void {
  try {
    if (typeof pendo === 'undefined' || typeof pendo.track !== 'function') return
    pendo.track(eventName, properties)
  } catch (err) {
    console.error('[pendo] track failed:', err)
  }
}
