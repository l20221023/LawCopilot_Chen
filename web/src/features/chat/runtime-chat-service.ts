import { createChatService } from './chat-service'
import { mockChatService } from './mock-chat-service'
import { isSupabaseConfigured } from '../../lib/supabase/client'
import {
  createSupabaseAssistantMessage,
  createSupabaseConversation,
  createSupabaseUserMessage,
  deleteSupabaseConversation,
  listSupabaseConversations,
  listSupabaseMessages,
  updateSupabaseAssistantMessage,
} from '../../lib/supabase/chat'

const supabaseChatService = createChatService({
  createAssistantMessage: async (input) => createSupabaseAssistantMessage(input),
  createConversation: async (input) => createSupabaseConversation(input),
  createUserMessage: async (input) => createSupabaseUserMessage(input),
  deleteConversation: async (input) => deleteSupabaseConversation(input.conversationId),
  listConversations: async (input) => listSupabaseConversations(input.userId),
  listMessages: async (input) => listSupabaseMessages(input.conversationId),
  updateAssistantMessage: async (input) => updateSupabaseAssistantMessage(input),
})

export const chatService = isSupabaseConfigured
  ? supabaseChatService
  : mockChatService
