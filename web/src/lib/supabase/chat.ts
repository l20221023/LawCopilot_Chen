import { supabase } from './client'
import { SupabaseServiceError } from './errors'
import type {
  ChatMessage,
  ChatMessageStatus,
  Conversation,
  CreateAssistantMessageInput,
  CreateConversationInput,
  CreateUserMessageInput,
  UpdateAssistantMessageInput,
} from '../../types/chat'

const conversationColumns = [
  'id',
  'user_id',
  'title',
  'scenario_id',
  'last_message_preview',
  'created_at',
  'updated_at',
].join(', ')

const messageColumns = [
  'id',
  'conversation_id',
  'role',
  'content',
  'attachments',
  'input_tokens',
  'output_tokens',
  'status',
  'parent_message_id',
  'error_message',
  'metadata',
  'created_at',
  'updated_at',
].join(', ')

type ConversationRow = Conversation

type MessageRow = Omit<ChatMessage, 'attachments'> & {
  attachments: ChatMessage['attachments'] | null
}

function getSupabaseClient() {
  if (!supabase) {
    throw new SupabaseServiceError(
      'SUPABASE_NOT_CONFIGURED',
      'Supabase env vars are missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY first.',
    )
  }

  return supabase
}

function buildAttachmentPreview(attachments: ChatMessage['attachments']) {
  if (attachments.length === 0) {
    return 'No messages yet.'
  }

  const firstAttachment = attachments[0]

  if (attachments.length === 1) {
    return `Uploaded attachment: ${firstAttachment.name}`
  }

  return `Uploaded ${attachments.length} attachments. First attachment: ${firstAttachment.name}`
}

function buildConversationPreview(
  content: string,
  attachments: ChatMessage['attachments'] = [],
) {
  const trimmedContent = content.trim()

  if (trimmedContent) {
    return trimmedContent.slice(0, 120)
  }

  return buildAttachmentPreview(attachments)
}

function normalizeConversation(row: unknown): Conversation {
  const typedRow = row as ConversationRow

  return {
    created_at: typedRow.created_at,
    id: typedRow.id,
    last_message_preview: typedRow.last_message_preview ?? null,
    scenario_id: typedRow.scenario_id,
    title: typedRow.title,
    updated_at: typedRow.updated_at,
    user_id: typedRow.user_id,
  }
}

function normalizeMessage(row: unknown): ChatMessage {
  const typedRow = row as MessageRow

  return {
    attachments: Array.isArray(typedRow.attachments) ? typedRow.attachments : [],
    content: typedRow.content,
    conversation_id: typedRow.conversation_id,
    created_at: typedRow.created_at,
    error_message: typedRow.error_message ?? null,
    id: typedRow.id,
    input_tokens: typedRow.input_tokens ?? null,
    metadata: typedRow.metadata ?? undefined,
    output_tokens: typedRow.output_tokens ?? null,
    parent_message_id: typedRow.parent_message_id ?? null,
    role: typedRow.role,
    status: (typedRow.status as ChatMessageStatus | undefined) ?? 'complete',
    updated_at: typedRow.updated_at,
  }
}

async function updateConversationSnapshot(params: {
  conversationId: string
  content: string
  timestamp: string
  attachments?: ChatMessage['attachments']
}) {
  const client = getSupabaseClient()
  const preview = buildConversationPreview(params.content, params.attachments ?? [])

  const { error } = await client
    .from('conversations')
    .update({
      last_message_preview: preview,
      updated_at: params.timestamp,
    })
    .eq('id', params.conversationId)

  if (error) {
    throw error
  }
}

export async function listSupabaseConversations(userId: string) {
  const client = getSupabaseClient()
  const { data, error } = await client
    .from('conversations')
    .select(conversationColumns)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []).map((row) => normalizeConversation(row))
}

export async function createSupabaseConversation(input: CreateConversationInput) {
  const client = getSupabaseClient()
  const timestamp = new Date().toISOString()
  const payload = {
    created_at: timestamp,
    id: crypto.randomUUID(),
    last_message_preview: null,
    scenario_id: input.scenarioId ?? 'contract-review',
    title: input.title?.trim() || 'New conversation',
    updated_at: timestamp,
    user_id: input.userId,
  }

  const { data, error } = await client
    .from('conversations')
    .insert(payload)
    .select(conversationColumns)
    .single()

  if (error) {
    throw error
  }

  return normalizeConversation(data)
}

export async function deleteSupabaseConversation(conversationId: string) {
  const client = getSupabaseClient()
  const { error: messageDeleteError } = await client
    .from('messages')
    .delete()
    .eq('conversation_id', conversationId)

  if (messageDeleteError) {
    throw messageDeleteError
  }

  const { error } = await client
    .from('conversations')
    .delete()
    .eq('id', conversationId)

  if (error) {
    throw error
  }
}

export async function listSupabaseMessages(conversationId: string) {
  const client = getSupabaseClient()
  const { data, error } = await client
    .from('messages')
    .select(messageColumns)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []).map((row) => normalizeMessage(row))
}

export async function createSupabaseUserMessage(input: CreateUserMessageInput) {
  const client = getSupabaseClient()
  const timestamp = new Date().toISOString()
  const payload = {
    attachments: input.attachments ?? [],
    content: input.content,
    conversation_id: input.conversationId,
    created_at: timestamp,
    error_message: null,
    id: crypto.randomUUID(),
    metadata: null,
    output_tokens: null,
    parent_message_id: null,
    role: 'user',
    status: 'complete',
    updated_at: timestamp,
  }

  const { data, error } = await client
    .from('messages')
    .insert(payload)
    .select(messageColumns)
    .single()

  if (error) {
    throw error
  }

  await updateConversationSnapshot({
    attachments: input.attachments ?? [],
    content: input.content,
    conversationId: input.conversationId,
    timestamp,
  })

  return normalizeMessage(data)
}

export async function createSupabaseAssistantMessage(
  input: CreateAssistantMessageInput,
) {
  const client = getSupabaseClient()
  const timestamp = new Date().toISOString()
  const payload = {
    attachments: [],
    content: input.content ?? '',
    conversation_id: input.conversationId,
    created_at: timestamp,
    error_message: null,
    id: crypto.randomUUID(),
    metadata: input.metadata ?? null,
    output_tokens: null,
    parent_message_id: input.parentMessageId ?? null,
    role: 'assistant',
    status: input.status ?? 'pending',
    updated_at: timestamp,
  }

  const { data, error } = await client
    .from('messages')
    .insert(payload)
    .select(messageColumns)
    .single()

  if (error) {
    throw error
  }

  await updateConversationSnapshot({
    content: input.content ?? '',
    conversationId: input.conversationId,
    timestamp,
  })

  return normalizeMessage(data)
}

export async function updateSupabaseAssistantMessage(
  input: UpdateAssistantMessageInput,
) {
  const client = getSupabaseClient()
  const nextPatch = {
    ...input.patch,
    updated_at: input.patch.updated_at ?? new Date().toISOString(),
  }

  const { data, error } = await client
    .from('messages')
    .update(nextPatch)
    .eq('id', input.messageId)
    .eq('conversation_id', input.conversationId)
    .select(messageColumns)
    .single()

  if (error) {
    throw error
  }

  const normalizedMessage = normalizeMessage(data)

  await updateConversationSnapshot({
    attachments: normalizedMessage.attachments,
    content: normalizedMessage.content,
    conversationId: input.conversationId,
    timestamp: normalizedMessage.updated_at ?? nextPatch.updated_at,
  })

  return normalizedMessage
}
