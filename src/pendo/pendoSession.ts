/**
 * Reset Pendo to a fresh anonymous visitor so the next user is not tracked
 * under the previous user's identity.
 *
 * `clearSession` is not part of the install snippet's pre-load stub, so guard
 * against the agent not having loaded yet (or being blocked) — sign-out must
 * never throw because of analytics.
 */
export function clearPendoSession(): void {
  if (typeof window.pendo?.clearSession === 'function') {
    window.pendo.clearSession()
  }
}
