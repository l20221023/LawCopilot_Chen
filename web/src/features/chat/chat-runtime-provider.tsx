import type { PropsWithChildren } from 'react'

import { useAuth } from '../auth/use-auth'
import { getDefaultScenarioId, resolveScenarioId } from '../scenarios'
import { ChatRuntimeContext } from './chat-runtime-context'
import { useChatController } from './use-chat-controller'

export function ChatRuntimeProvider({ children }: PropsWithChildren) {
  const { profile, updateProfile } = useAuth()
  const defaultScenarioId = resolveScenarioId({
    defaultScenarioId: getDefaultScenarioId(profile),
  })
  const chat = useChatController({
    profile,
    scenarioId: defaultScenarioId,
    updateProfile,
  })

  return (
    <ChatRuntimeContext.Provider value={chat}>
      {children}
    </ChatRuntimeContext.Provider>
  )
}
