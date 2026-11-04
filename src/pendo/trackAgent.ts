/**
 * Thin wrapper around Pendo's `trackAgent()` for conversational AI analytics.
 *
 * The Pendo snippet may not be installed (see PendoBridge.tsx), so every call
 * is guarded — a missing `window.pendo` makes tracking a silent no-op rather
 * than breaking the chat flow.
 */

export type TrackAgentEventType = 'prompt' | 'agent_response' | 'user_reaction'

export interface TrackAgentMetadata {
  agentId: string
  conversationId: string
  messageId: string
  content: string
  modelUsed?: string
  suggestedPrompt?: boolean
  toolsUsed?: string[]
  fileUploaded?: boolean
}

declare global {
  interface Window {
    pendo?: {
      trackAgent?: (eventType: TrackAgentEventType, metadata: TrackAgentMetadata) => void
    }
  }
}

/** Pendo agentId for the Halo Assistant chat panel (src/chat/ChatPanel.tsx). */
export const HALO_ASSISTANT_AGENT_ID = '6efHMVUqyxvzjnqaqAma4cMlcLM'

export function trackAgent(eventType: TrackAgentEventType, metadata: TrackAgentMetadata): void {
  try {
    window.pendo?.trackAgent?.(eventType, metadata)
  } catch {
    // Analytics must never interfere with the chat experience.
  }
}
