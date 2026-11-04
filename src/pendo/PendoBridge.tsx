/**
 * PendoBridge — provider slot for Pendo install & wiring.
 *
 * The agent snippet lives in index.html and `pendo.initialize` runs exactly
 * once in src/main.tsx before React mounts. This component keeps Pendo's
 * visitor/account identity in sync with the auth store:
 *
 *   - On mount, a session already hydrated from storage (refresh) is
 *     identified immediately.
 *   - Sign-in (`setSession`, used by both sign-in and signup completion) and
 *     Settings profile/workspace saves replace `currentVisitor` /
 *     `currentWorkspace`, which triggers `pendo.identify` with fresh metadata.
 *   - Sign-out (`clearSession`) flips `isAuthenticated` to false, which
 *     triggers `pendo.clearSession` so the next user starts anonymous.
 *
 * The component's position in the App.tsx provider stack is fixed per FND-07.
 */

import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { useAuthStore } from '../auth'
import type { Session, Visitor, Workspace } from '../auth'
import { K, readWithSchema, SessionSchema } from '../storage'
import { clearPendoSession } from './pendoSession'

function identifyPendo(visitor: Visitor, workspace: Workspace): void {
  const session = readWithSchema<Session | null>(K.session(), SessionSchema, null)

  pendo.identify({
    visitor: {
      id: visitor.id,
      email: visitor.email,
      full_name: `${visitor.firstName} ${visitor.lastName}`,
      accountId: workspace.id,
      firstName: visitor.firstName,
      lastName: visitor.lastName,
      username: visitor.username,
      jobTitle: visitor.jobTitle,
      role: visitor.role,
      yearsExperience: visitor.yearsExperience,
      location: visitor.location,
      primaryUseCase: visitor.primaryUseCase,
      teamSize: visitor.teamSize,
      topGoals: visitor.topGoals,
      createdAt: visitor.createdAt,
      signedInAt: session?.signedInAt,
    },
    account: {
      id: workspace.id,
      name: workspace.companyName,
      companyName: workspace.companyName,
      companySize: workspace.companySize,
      industry: workspace.industry,
      planTier: workspace.planTier,
      createdAt: workspace.createdAt,
    },
  })
}

export function PendoBridge({ children }: { children: ReactNode }) {
  useEffect(() => {
    const { currentVisitor, currentWorkspace } = useAuthStore.getState()
    if (currentVisitor && currentWorkspace) {
      identifyPendo(currentVisitor, currentWorkspace)
    }

    return useAuthStore.subscribe((state, prev) => {
      if (state.currentVisitor && state.currentWorkspace) {
        if (
          state.currentVisitor !== prev.currentVisitor ||
          state.currentWorkspace !== prev.currentWorkspace
        ) {
          identifyPendo(state.currentVisitor, state.currentWorkspace)
        }
      } else if (prev.isAuthenticated && !state.isAuthenticated) {
        clearPendoSession()
      }
    })
  }, [])

  return <>{children}</>
}
