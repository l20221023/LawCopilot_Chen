import { createChatService } from './chat-service'
import type {
  ChatMessage,
  ChatService,
  Conversation,
  CreateAssistantMessageInput,
  CreateConversationInput,
  CreateUserMessageInput,
  DeleteConversationInput,
  ListConversationsInput,
  ListMessagesInput,
  UpdateAssistantMessageInput,
  UpdateConversationInput,
} from '../../types/chat'

type ChatStore = {
  conversations: Conversation[]
  messagesByConversation: Record<string, ChatMessage[]>
}

const STORAGE_KEY = 'lawcopilot-chat-store-v1'
const DEFAULT_SCENARIO_ID = 'contract-review'
const PREVIEW_USER_ID = 'preview-user'

function now() {
  return new Date().toISOString()
}

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

function buildSeedStore(): ChatStore {
  const conversationAId = createId('conv')
  const conversationBId = createId('conv')
  const firstCreatedAt = new Date(Date.now() - 1000 * 60 * 45).toISOString()
  const secondCreatedAt = new Date(Date.now() - 1000 * 60 * 12).toISOString()

  return {
    conversations: [
      {
        id: conversationBId,
        user_id: PREVIEW_USER_ID,
        title: '合同审阅要点',
        scenario_id: DEFAULT_SCENARIO_ID,
        last_message_preview: '这里先保留 mock assistant 回复，后续接真实流式输出。',
        created_at: secondCreatedAt,
        updated_at: secondCreatedAt,
      },
      {
        id: conversationAId,
        user_id: PREVIEW_USER_ID,
        title: '劳动争议初步分析',
        scenario_id: DEFAULT_SCENARIO_ID,
        last_message_preview: '我先整理案件事实，再抽出争议焦点和补证建议。',
        created_at: firstCreatedAt,
        updated_at: firstCreatedAt,
      },
    ],
    messagesByConversation: {
      [conversationAId]: [
        {
          id: createId('msg'),
          conversation_id: conversationAId,
          role: 'user',
          content: '员工主张被违法解除，现阶段应该先整理哪些事实？',
          attachments: [],
          status: 'complete',
          created_at: firstCreatedAt,
          updated_at: firstCreatedAt,
        },
        {
          id: createId('msg'),
          conversation_id: conversationAId,
          role: 'assistant',
          content: '我先整理案件事实，再抽出争议焦点和补证建议。',
          attachments: [],
          status: 'complete',
          metadata: {
            finish_reason: 'complete',
            model: 'mock-lawcopilot',
          },
          created_at: firstCreatedAt,
          updated_at: firstCreatedAt,
        },
      ],
      [conversationBId]: [
        {
          id: createId('msg'),
          conversation_id: conversationBId,
          role: 'user',
          content: '帮我列一个合同风险审阅的检查框架。',
          attachments: [],
          status: 'complete',
          created_at: secondCreatedAt,
          updated_at: secondCreatedAt,
        },
        {
          id: createId('msg'),
          conversation_id: conversationBId,
          role: 'assistant',
          content: '这里先保留 mock assistant 回复，后续接真实流式输出。',
          attachments: [],
          status: 'complete',
          metadata: {
            finish_reason: 'complete',
            model: 'mock-lawcopilot',
          },
          created_at: secondCreatedAt,
          updated_at: secondCreatedAt,
        },
      ],
    },
  }
}

function cloneStore(store: ChatStore): ChatStore {
  return {
    conversations: [...store.conversations],
    messagesByConversation: Object.fromEntries(
      Object.entries(store.messagesByConversation).map(([conversationId, messages]) => [
        conversationId,
        [...messages],
      ]),
    ),
  }
}

function readStore() {
  if (typeof window === 'undefined') {
    return buildSeedStore()
  }

  const raw = window.localStorage.getItem(STORAGE_KEY)

  if (!raw) {
    const seededStore = buildSeedStore()
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seededStore))
    return seededStore
  }

  try {
    return JSON.parse(raw) as ChatStore
  } catch {
    const seededStore = buildSeedStore()
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seededStore))
    return seededStore
  }
}

function writeStore(store: ChatStore) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

function buildAttachmentPreview(attachments: ChatMessage['attachments']) {
  if (attachments.length === 0) {
    return '暂无消息，等待第一条用户输入。'
  }

  const firstAttachment = attachments[0]

  if (attachments.length === 1) {
    return `已上传附件：${firstAttachment.name}`
  }

  return `已上传 ${attachments.length} 个附件，首个附件：${firstAttachment.name}`
}

function upsertConversationSnapshot(
  store: ChatStore,
  conversationId: string,
  messageContent: string,
  timestamp: string,
) {
  const conversation = store.conversations.find((item) => item.id === conversationId)

  if (!conversation) {
    return
  }

  conversation.last_message_preview = messageContent.slice(0, 120)
  conversation.updated_at = timestamp
  store.conversations.sort((left, right) =>
    right.updated_at.localeCompare(left.updated_at),
  )
}

function listConversations({ userId }: ListConversationsInput) {
  const store = readStore()

  return store.conversations
    .filter((conversation) => conversation.user_id === userId)
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at))
}

function createConversation({
  userId,
  scenarioId = DEFAULT_SCENARIO_ID,
  title = '新建会话',
}: CreateConversationInput) {
  const store = cloneStore(readStore())
  const timestamp = now()
  const conversation: Conversation = {
    id: createId('conv'),
    user_id: userId,
    title,
    scenario_id: scenarioId,
    last_message_preview: null,
    created_at: timestamp,
    updated_at: timestamp,
  }

  store.conversations = [conversation, ...store.conversations]
  store.messagesByConversation[conversation.id] = []
  writeStore(store)
  return conversation
}

function deleteConversation({ conversationId }: DeleteConversationInput) {
  const store = cloneStore(readStore())
  store.conversations = store.conversations.filter(
    (conversation) => conversation.id !== conversationId,
  )
  delete store.messagesByConversation[conversationId]
  writeStore(store)
}

function updateConversation({ conversationId, patch }: UpdateConversationInput) {
  const store = cloneStore(readStore())
  const conversation = store.conversations.find((item) => item.id === conversationId)

  if (!conversation) {
    throw new Error('Conversation not found')
  }

  Object.assign(conversation, patch, {
    updated_at: patch.updated_at ?? now(),
  })
  store.conversations.sort((left, right) =>
    right.updated_at.localeCompare(left.updated_at),
  )
  writeStore(store)
  return conversation
}

function listMessages({ conversationId }: ListMessagesInput) {
  const store = readStore()
  return [...(store.messagesByConversation[conversationId] ?? [])]
}

function createUserMessage({
  conversationId,
  content,
  attachments = [],
}: CreateUserMessageInput) {
  const store = cloneStore(readStore())
  const timestamp = now()
  const message: ChatMessage = {
    id: createId('msg'),
    conversation_id: conversationId,
    role: 'user',
    content,
    attachments,
    status: 'complete',
    created_at: timestamp,
    updated_at: timestamp,
  }

  const messages = store.messagesByConversation[conversationId] ?? []
  messages.push(message)
  store.messagesByConversation[conversationId] = messages
  upsertConversationSnapshot(
    store,
    conversationId,
    content || buildAttachmentPreview(attachments),
    timestamp,
  )
  writeStore(store)
  return message
}

function createAssistantMessage({
  conversationId,
  content = '',
  parentMessageId = null,
  status = 'pending',
  metadata,
}: CreateAssistantMessageInput) {
  const store = cloneStore(readStore())
  const timestamp = now()
  const message: ChatMessage = {
    id: createId('msg'),
    conversation_id: conversationId,
    role: 'assistant',
    content,
    attachments: [],
    parent_message_id: parentMessageId,
    status,
    metadata,
    created_at: timestamp,
    updated_at: timestamp,
  }

  const messages = store.messagesByConversation[conversationId] ?? []
  messages.push(message)
  store.messagesByConversation[conversationId] = messages
  upsertConversationSnapshot(store, conversationId, content, timestamp)
  writeStore(store)
  return message
}

function updateAssistantMessage({
  conversationId,
  messageId,
  patch,
}: UpdateAssistantMessageInput) {
  const store = cloneStore(readStore())
  const messages = store.messagesByConversation[conversationId] ?? []
  const message = messages.find((item) => item.id === messageId)

  if (!message) {
    throw new Error('Assistant message not found')
  }

  const timestamp = patch.updated_at ?? now()
  Object.assign(message, patch, { updated_at: timestamp })
  upsertConversationSnapshot(store, conversationId, message.content, timestamp)
  writeStore(store)
  return message
}

const service: ChatService = {
  listConversations: async (input) => listConversations(input),
  createConversation: async (input) => createConversation(input),
  deleteConversation: async (input) => deleteConversation(input),
  updateConversation: async (input) => updateConversation(input),
  listMessages: async (input) => listMessages(input),
  createUserMessage: async (input) => createUserMessage(input),
  createAssistantMessage: async (input) => createAssistantMessage(input),
  updateAssistantMessage: async (input) => updateAssistantMessage(input),
}

export const mockChatService = createChatService(service)
export { PREVIEW_USER_ID }
