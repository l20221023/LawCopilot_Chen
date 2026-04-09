import { createContext } from 'react'

import type { useChatController } from './use-chat-controller'

export type ChatRuntimeValue = ReturnType<typeof useChatController>

export const ChatRuntimeContext = createContext<ChatRuntimeValue | null>(null)
