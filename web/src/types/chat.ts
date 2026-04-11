export const attachmentTypes = ['image', 'pdf', 'txt'] as const

export type AttachmentType = (typeof attachmentTypes)[number]

export type ChatMessageRole = 'system' | 'user' | 'assistant'

export type ChatMessageStatus =
  | 'pending'
  | 'streaming'
  | 'complete'
  | 'stopped'
  | 'error'

export type ChatStreamPhase =
  | 'idle'
  | 'submitting'
  | 'preparing-assistant'
  | 'streaming'
  | 'stopping'
  | 'error'

export type MessageAttachment = {
  id: string
  type: AttachmentType
  name: string
  size: number
  mime_type: string
  storage_path?: string | null
  extracted_text?: string | null
  preview_data_url?: string | null
}

export type ChatAttachmentRequestPart =
  | {
      type: 'image_url'
      attachment_id: string
      name: string
      mime_type: string
      image_url: {
        url: string
      }
    }
  | {
      type: 'text'
      attachment_id: string
      name: string
      mime_type: string
      text: string
    }

export type PreparedMessageAttachments = {
  attachments: MessageAttachment[]
  content_parts: ChatAttachmentRequestPart[]
  extracted_text: string
}

export type Conversation = {
  id: string
  user_id: string
  title: string
  scenario_id: string
  last_message_preview?: string | null
  created_at: string
  updated_at: string
}

export type ChatMessage = {
  id: string
  conversation_id: string
  role: ChatMessageRole
  content: string
  attachments: MessageAttachment[]
  input_tokens?: number | null
  output_tokens?: number | null
  status?: ChatMessageStatus
  parent_message_id?: string | null
  error_message?: string | null
  updated_at?: string
  metadata?: {
    model?: string | null
    finish_reason?: 'complete' | 'stopped' | 'error' | 'placeholder'
    regeneration_of?: string | null
  }
  created_at: string
}

export type ChatStreamState = {
  phase: ChatStreamPhase
  conversationId: string | null
  assistantMessageId: string | null
  startedAt: string | null
  lastChunkAt: string | null
  abortable: boolean
  error: string | null
}

export type ChatComposerState = {
  value: string
}

export type ChatStateSnapshot = {
  conversations: Conversation[]
  activeConversationId: string | null
  messagesByConversation: Record<string, ChatMessage[]>
  composer: ChatComposerState
  stream: ChatStreamState
}

export type ListConversationsInput = {
  userId: string
}

export type CreateConversationInput = {
  userId: string
  scenarioId?: string
  title?: string
}

export type DeleteConversationInput = {
  conversationId: string
}

export type UpdateConversationInput = {
  conversationId: string
  patch: Partial<Pick<Conversation, 'title' | 'last_message_preview' | 'updated_at'>>
}

export type ListMessagesInput = {
  conversationId: string
}

export type CreateUserMessageInput = {
  conversationId: string
  content: string
  attachments?: MessageAttachment[]
}

export type CreateAssistantMessageInput = {
  conversationId: string
  content?: string
  parentMessageId?: string | null
  status?: ChatMessageStatus
  metadata?: ChatMessage['metadata']
}

export type UpdateAssistantMessageInput = {
  conversationId: string
  messageId: string
  patch: Partial<
    Pick<ChatMessage, 'content' | 'status' | 'error_message' | 'output_tokens'>
  > & {
    updated_at?: string
    metadata?: ChatMessage['metadata']
  }
}

export type ChatService = {
  listConversations(input: ListConversationsInput): Promise<Conversation[]>
  createConversation(input: CreateConversationInput): Promise<Conversation>
  deleteConversation(input: DeleteConversationInput): Promise<void>
  updateConversation(input: UpdateConversationInput): Promise<Conversation>
  listMessages(input: ListMessagesInput): Promise<ChatMessage[]>
  createUserMessage(input: CreateUserMessageInput): Promise<ChatMessage>
  createAssistantMessage(input: CreateAssistantMessageInput): Promise<ChatMessage>
  updateAssistantMessage(input: UpdateAssistantMessageInput): Promise<ChatMessage>
}
