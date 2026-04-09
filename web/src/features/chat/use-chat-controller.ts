import { useEffect, useRef, useState } from 'react'

import {
  checkQuotaBeforeSendForProfile,
  consumeCreditAfterSuccessForProfile,
} from '../billing/billing-service'
import { resolveSubscriptionExpiry } from '../billing/billing-rules'
import { recordUsageLog } from '../usage/usage-service'
import { prepareMessageAttachments } from '../../lib/ai/prepare-chat-attachments'
import type { UserProfile, UserProfilePatch } from '../../types/auth'
import type {
  ChatMessage,
  ChatStateSnapshot,
  ChatStreamState,
  Conversation,
  MessageAttachment,
  PreparedMessageAttachments,
} from '../../types/chat'
import { mockChatService } from './mock-chat-service'

const STREAM_CHUNK_INTERVAL = 180
const MOCK_MODEL_NAME = 'mock-lawcopilot'

const initialStreamState: ChatStreamState = {
  phase: 'idle',
  conversationId: null,
  assistantMessageId: null,
  startedAt: null,
  lastChunkAt: null,
  abortable: false,
  error: null,
}

type UseChatControllerOptions = {
  profile: UserProfile | null
  scenarioId: string
  updateProfile: (patch: UserProfilePatch) => Promise<UserProfile | null>
}

type UseChatControllerResult = {
  activeConversation: Conversation | null
  conversations: Conversation[]
  isBusy: boolean
  isLoading: boolean
  messages: ChatMessage[]
  copiedMessageId: string | null
  composerValue: string
  stream: ChatStreamState
  snapshot: ChatStateSnapshot
  createConversation(scenarioId?: string): Promise<void>
  deleteConversation(conversationId: string): Promise<void>
  selectConversation(conversationId: string): Promise<void>
  updateComposer(value: string): void
  sendMessage(
    attachments?: MessageAttachment[],
    requestAttachments?: PreparedMessageAttachments,
  ): Promise<boolean>
  stopGeneration(): Promise<void>
  copyMessage(content: string, messageId: string): Promise<void>
  regenerateMessage(messageId: string): Promise<void>
}

type StreamResult = {
  completed: boolean
  content: string
  modelName: string
  outputTokens: number
}

function buildMockAssistantResponse(
  prompt: string,
  requestAttachments?: PreparedMessageAttachments,
) {
  const trimmedPrompt = prompt.trim()
  const responseBlocks = [
    'The current assistant flow is still backed by the local mock chat service.',
    trimmedPrompt
      ? `Question summary: ${trimmedPrompt}`
      : 'No plain-text prompt was supplied, only attachments.',
  ]

  if (requestAttachments && requestAttachments.attachments.length > 0) {
    responseBlocks.push(
      `Attachment summary: ${requestAttachments.attachments.length} attachment(s) mapped into ${requestAttachments.content_parts.length} request content part(s).`,
    )

    if (requestAttachments.extracted_text) {
      responseBlocks.push(
        `Extracted text preview: ${requestAttachments.extracted_text.slice(0, 140)}${
          requestAttachments.extracted_text.length > 140 ? '...' : ''
        }`,
      )
    }
  }

  responseBlocks.push(
    'Session 6 now wires quota checks, usage logging, and post-success credit consumption around this streaming placeholder.',
  )
  responseBlocks.push(
    'When the real AI endpoint is connected, the existing stream state and message model can be reused directly.',
  )

  return responseBlocks.join('\n\n')
}

function createEmptySnapshot(): ChatStateSnapshot {
  return {
    conversations: [],
    activeConversationId: null,
    messagesByConversation: {},
    composer: {
      value: '',
    },
    stream: initialStreamState,
  }
}

function estimateTokenCount(...segments: Array<string | null | undefined>) {
  const totalLength = segments
    .filter((segment): segment is string => Boolean(segment?.trim()))
    .join('\n')
    .trim().length

  if (totalLength <= 0) {
    return 0
  }

  return Math.max(1, Math.ceil(totalLength / 4))
}

function getBillingPatch(profile: UserProfile): UserProfilePatch {
  return {
    remaining_credits: profile.remaining_credits,
    subscription_expires_at: profile.subscription_expires_at,
    subscription_plan: profile.subscription_plan,
  }
}

function hasBillingChanges(current: UserProfile, next: UserProfile) {
  return (
    current.remaining_credits !== next.remaining_credits ||
    current.subscription_plan !== next.subscription_plan ||
    current.subscription_expires_at !== next.subscription_expires_at
  )
}

export function useChatController({
  profile,
  scenarioId,
  updateProfile,
}: UseChatControllerOptions): UseChatControllerResult {
  const [snapshot, setSnapshot] = useState<ChatStateSnapshot>(createEmptySnapshot)
  const [isLoading, setIsLoading] = useState(true)
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const streamTimerRef = useRef<number | null>(null)
  const copyTimerRef = useRef<number | null>(null)
  const streamResolverRef = useRef<(() => void) | null>(null)
  const streamOutcomeRef = useRef<'complete' | 'stopped'>('complete')
  const profileRef = useRef<UserProfile | null>(profile)

  const userId = profile?.id ?? null

  const activeConversation =
    snapshot.conversations.find(
      (conversation) => conversation.id === snapshot.activeConversationId,
    ) ?? null

  const messages =
    (snapshot.activeConversationId
      ? snapshot.messagesByConversation[snapshot.activeConversationId]
      : undefined) ?? []

  const isBusy =
    snapshot.stream.phase === 'submitting' ||
    snapshot.stream.phase === 'preparing-assistant' ||
    snapshot.stream.phase === 'streaming' ||
    snapshot.stream.phase === 'stopping'

  useEffect(() => {
    profileRef.current = profile
  }, [profile])

  useEffect(() => {
    let disposed = false

    async function bootstrap() {
      if (!userId) {
        setSnapshot(createEmptySnapshot())
        setIsLoading(false)
        return
      }

      setIsLoading(true)

      const conversations = await mockChatService.listConversations({
        userId,
      })

      if (disposed) {
        return
      }

      const activeConversationId = conversations[0]?.id ?? null
      const messagesByConversation: ChatStateSnapshot['messagesByConversation'] = {}

      if (activeConversationId) {
        messagesByConversation[activeConversationId] =
          await mockChatService.listMessages({
            conversationId: activeConversationId,
          })
      }

      if (disposed) {
        return
      }

      setSnapshot({
        conversations,
        activeConversationId,
        messagesByConversation,
        composer: {
          value: '',
        },
        stream: initialStreamState,
      })
      setIsLoading(false)
    }

    void bootstrap()

    return () => {
      disposed = true

      if (streamTimerRef.current) {
        window.clearInterval(streamTimerRef.current)
      }

      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current)
      }

      streamResolverRef.current?.()
    }
  }, [userId])

  async function persistBillingProfile(nextProfile: UserProfile) {
    const currentProfile = profileRef.current

    if (!currentProfile || !hasBillingChanges(currentProfile, nextProfile)) {
      return
    }

    profileRef.current = nextProfile

    try {
      const persistedProfile = await updateProfile(getBillingPatch(nextProfile))

      if (persistedProfile) {
        profileRef.current = persistedProfile
      }
    } catch (error) {
      profileRef.current = currentProfile
      throw error
    }
  }

  async function ensureConversationLoaded(conversationId: string) {
    const cachedMessages = snapshot.messagesByConversation[conversationId]

    if (cachedMessages) {
      return cachedMessages
    }

    const messagesForConversation = await mockChatService.listMessages({
      conversationId,
    })

    setSnapshot((currentSnapshot) => ({
      ...currentSnapshot,
      messagesByConversation: {
        ...currentSnapshot.messagesByConversation,
        [conversationId]: messagesForConversation,
      },
    }))

    return messagesForConversation
  }

  async function refreshConversations(
    ownerUserId: string,
    nextActiveConversationId?: string | null,
  ) {
    const conversations = await mockChatService.listConversations({
      userId: ownerUserId,
    })

    setSnapshot((currentSnapshot) => ({
      ...currentSnapshot,
      conversations,
      activeConversationId:
        nextActiveConversationId === undefined
          ? currentSnapshot.activeConversationId
          : nextActiveConversationId,
    }))

    return conversations
  }

  async function selectConversation(conversationId: string) {
    const messagesForConversation = await ensureConversationLoaded(conversationId)

    setSnapshot((currentSnapshot) => ({
      ...currentSnapshot,
      activeConversationId: conversationId,
      messagesByConversation: {
        ...currentSnapshot.messagesByConversation,
        [conversationId]: messagesForConversation,
      },
      stream:
        currentSnapshot.stream.phase === 'error'
          ? initialStreamState
          : currentSnapshot.stream,
    }))
  }

  async function createConversation(nextScenarioId = scenarioId) {
    if (!userId) {
      return
    }

    const conversation = await mockChatService.createConversation({
      userId,
      scenarioId: nextScenarioId,
      title: 'New conversation',
    })

    await refreshConversations(userId, conversation.id)
    setSnapshot((currentSnapshot) => ({
      ...currentSnapshot,
      activeConversationId: conversation.id,
      messagesByConversation: {
        ...currentSnapshot.messagesByConversation,
        [conversation.id]: [],
      },
      composer: {
        value: '',
      },
      stream: initialStreamState,
    }))
  }

  async function deleteConversation(conversationId: string) {
    if (!userId) {
      return
    }

    if (snapshot.stream.conversationId === conversationId && isBusy) {
      await stopGeneration()
    }

    await mockChatService.deleteConversation({ conversationId })
    const conversations = await refreshConversations(userId)
    const fallbackConversationId =
      snapshot.activeConversationId === conversationId
        ? conversations[0]?.id ?? null
        : snapshot.activeConversationId

    setSnapshot((currentSnapshot) => {
      const nextMessagesByConversation = { ...currentSnapshot.messagesByConversation }
      delete nextMessagesByConversation[conversationId]

      return {
        ...currentSnapshot,
        activeConversationId: fallbackConversationId,
        conversations,
        messagesByConversation: nextMessagesByConversation,
        stream:
          currentSnapshot.stream.conversationId === conversationId
            ? initialStreamState
            : currentSnapshot.stream,
      }
    })

    if (fallbackConversationId) {
      await ensureConversationLoaded(fallbackConversationId)
    }
  }

  function updateComposer(value: string) {
    setSnapshot((currentSnapshot) => ({
      ...currentSnapshot,
      composer: {
        value,
      },
      stream:
        currentSnapshot.stream.phase === 'error'
          ? initialStreamState
          : currentSnapshot.stream,
    }))
  }

  async function appendMessageToState(
    conversationId: string,
    message: ChatMessage,
    activeConversationId = conversationId,
  ) {
    if (!userId) {
      return
    }

    const conversations = await mockChatService.listConversations({
      userId,
    })

    setSnapshot((currentSnapshot) => ({
      ...currentSnapshot,
      conversations,
      activeConversationId,
      messagesByConversation: {
        ...currentSnapshot.messagesByConversation,
        [conversationId]: [
          ...(currentSnapshot.messagesByConversation[conversationId] ?? []),
          message,
        ],
      },
    }))
  }

  async function runAssistantStream(
    conversationId: string,
    assistantMessageId: string,
    prompt: string,
    requestAttachments?: PreparedMessageAttachments,
    regenerationOf?: string,
  ): Promise<StreamResult> {
    const response = buildMockAssistantResponse(prompt, requestAttachments)
    const chunks = response.split(' ')
    const startedAt = new Date().toISOString()
    let currentContent = ''

    streamOutcomeRef.current = 'complete'

    setSnapshot((currentSnapshot) => ({
      ...currentSnapshot,
      stream: {
        phase: 'streaming',
        conversationId,
        assistantMessageId,
        startedAt,
        lastChunkAt: startedAt,
        abortable: true,
        error: null,
      },
    }))

    await mockChatService.updateAssistantMessage({
      conversationId,
      messageId: assistantMessageId,
      patch: {
        content: '',
        status: 'streaming',
        metadata: {
          finish_reason: 'placeholder',
          model: MOCK_MODEL_NAME,
          regeneration_of: regenerationOf ?? null,
        },
      },
    })

    setSnapshot((currentSnapshot) => ({
      ...currentSnapshot,
      messagesByConversation: {
        ...currentSnapshot.messagesByConversation,
        [conversationId]: (currentSnapshot.messagesByConversation[conversationId] ?? []).map(
          (message) =>
            message.id === assistantMessageId
              ? {
                  ...message,
                  content: '',
                  status: 'streaming',
                  metadata: {
                    finish_reason: 'placeholder',
                    model: MOCK_MODEL_NAME,
                    regeneration_of: regenerationOf ?? null,
                  },
                }
              : message,
        ),
      },
    }))

    let chunkIndex = 0

    await new Promise<void>((resolve) => {
      streamResolverRef.current = resolve
      streamTimerRef.current = window.setInterval(() => {
        chunkIndex += 1
        currentContent = `${chunks.slice(0, chunkIndex).join(' ')}${
          chunkIndex < chunks.length ? ' ' : ''
        }`
        const chunkTime = new Date().toISOString()

        void mockChatService.updateAssistantMessage({
          conversationId,
          messageId: assistantMessageId,
          patch: {
            content: currentContent,
            status: chunkIndex === chunks.length ? 'complete' : 'streaming',
            metadata: {
              finish_reason: chunkIndex === chunks.length ? 'complete' : 'placeholder',
              model: MOCK_MODEL_NAME,
              regeneration_of: regenerationOf ?? null,
            },
            updated_at: chunkTime,
          },
        })

        setSnapshot((currentSnapshot) => ({
          ...currentSnapshot,
          messagesByConversation: {
            ...currentSnapshot.messagesByConversation,
            [conversationId]: (
              currentSnapshot.messagesByConversation[conversationId] ?? []
            ).map((message) =>
              message.id === assistantMessageId
                ? {
                    ...message,
                    content: currentContent,
                    status: chunkIndex === chunks.length ? 'complete' : 'streaming',
                    updated_at: chunkTime,
                    metadata: {
                      finish_reason:
                        chunkIndex === chunks.length ? 'complete' : 'placeholder',
                      model: MOCK_MODEL_NAME,
                      regeneration_of: regenerationOf ?? null,
                    },
                  }
                : message,
            ),
          },
          stream:
            chunkIndex === chunks.length
              ? initialStreamState
              : {
                  ...currentSnapshot.stream,
                  phase: 'streaming',
                  lastChunkAt: chunkTime,
                  abortable: true,
                },
        }))

        if (chunkIndex >= chunks.length) {
          if (streamTimerRef.current) {
            window.clearInterval(streamTimerRef.current)
            streamTimerRef.current = null
          }

          streamResolverRef.current = null

          if (userId) {
            void refreshConversations(userId)
          }

          resolve()
        }
      }, STREAM_CHUNK_INTERVAL)
    })

    return {
      completed: streamOutcomeRef.current === 'complete' && chunkIndex >= chunks.length,
      content: currentContent,
      modelName: MOCK_MODEL_NAME,
      outputTokens: estimateTokenCount(currentContent),
    }
  }

  async function createAssistantDraft(
    conversationId: string,
    parentMessageId: string | null,
    regenerationOf?: string,
  ) {
    setSnapshot((currentSnapshot) => ({
      ...currentSnapshot,
      stream: {
        phase: 'preparing-assistant',
        conversationId,
        assistantMessageId: null,
        startedAt: new Date().toISOString(),
        lastChunkAt: null,
        abortable: false,
        error: null,
      },
    }))

    const assistantMessage = await mockChatService.createAssistantMessage({
      conversationId,
      parentMessageId,
      status: 'pending',
      metadata: {
        finish_reason: 'placeholder',
        model: MOCK_MODEL_NAME,
        regeneration_of: regenerationOf ?? null,
      },
    })

    await appendMessageToState(conversationId, assistantMessage)
    return assistantMessage
  }

  async function finalizeSuccessfulGeneration(params: {
    assistantMessageId: string
    conversationId: string
    conversationScenarioId: string
    inputContent: string
    profileForCharge: UserProfile
    requestAttachments?: PreparedMessageAttachments
    streamResult: StreamResult
    userMessageId: string
  }) {
    const {
      assistantMessageId,
      conversationId,
      conversationScenarioId,
      inputContent,
      profileForCharge,
      requestAttachments,
      streamResult,
      userMessageId,
    } = params

    const quotaProfile = resolveSubscriptionExpiry(profileForCharge).profile
    const creditCost = quotaProfile.subscription_plan === 'unlimited' ? 0 : 1

    await recordUsageLog({
      assistant_message_id: assistantMessageId,
      conversation_id: conversationId,
      credit_cost: creditCost,
      input_tokens: estimateTokenCount(inputContent, requestAttachments?.extracted_text),
      model_name: streamResult.modelName,
      output_tokens: streamResult.outputTokens,
      scenario_id: conversationScenarioId,
      user_id: userId!,
      user_message_id: userMessageId,
    })

    const chargeResult = consumeCreditAfterSuccessForProfile(quotaProfile, creditCost)

    if (hasBillingChanges(quotaProfile, chargeResult.profile)) {
      await persistBillingProfile(chargeResult.profile)
    }
  }

  async function sendMessage(
    attachments: MessageAttachment[] = [],
    requestAttachments?: PreparedMessageAttachments,
  ) {
    const currentProfile = profileRef.current

    if (!currentProfile || !userId) {
      return false
    }

    const content = snapshot.composer.value.trim()
    const hasInput = Boolean(content) || attachments.length > 0

    if (!hasInput || isBusy) {
      return false
    }

    const quotaCheck = checkQuotaBeforeSendForProfile(currentProfile)

    if (hasBillingChanges(currentProfile, quotaCheck.profile)) {
      await persistBillingProfile(quotaCheck.profile)
    }

    if (!quotaCheck.allowed) {
      setSnapshot((currentSnapshot) => ({
        ...currentSnapshot,
        stream: {
          ...initialStreamState,
          phase: 'error',
          conversationId: currentSnapshot.activeConversationId,
          error: quotaCheck.reason,
        },
      }))
      return false
    }

    let conversationId = snapshot.activeConversationId
    let conversationScenarioId = activeConversation?.scenario_id ?? scenarioId
    let accepted = false

    if (!conversationId) {
      const fallbackTitle =
        content ||
        attachments[0]?.name ||
        requestAttachments?.attachments[0]?.name ||
        'New conversation'
      const conversation = await mockChatService.createConversation({
        userId,
        scenarioId,
        title: fallbackTitle.slice(0, 32),
      })
      conversationId = conversation.id
      conversationScenarioId = conversation.scenario_id
      await refreshConversations(userId, conversation.id)
      setSnapshot((currentSnapshot) => ({
        ...currentSnapshot,
        activeConversationId: conversation.id,
        messagesByConversation: {
          ...currentSnapshot.messagesByConversation,
          [conversation.id]: [],
        },
      }))
    }

    setSnapshot((currentSnapshot) => ({
      ...currentSnapshot,
      composer: {
        value: '',
      },
      stream: {
        phase: 'submitting',
        conversationId,
        assistantMessageId: null,
        startedAt: new Date().toISOString(),
        lastChunkAt: null,
        abortable: false,
        error: null,
      },
    }))

    try {
      const userMessage = await mockChatService.createUserMessage({
        conversationId,
        content,
        attachments,
      })
      accepted = true

      await appendMessageToState(conversationId, userMessage)
      const assistantDraft = await createAssistantDraft(conversationId, userMessage.id)
      const streamResult = await runAssistantStream(
        conversationId,
        assistantDraft.id,
        content,
        requestAttachments,
      )

      if (!streamResult.completed) {
        return accepted
      }

      await finalizeSuccessfulGeneration({
        assistantMessageId: assistantDraft.id,
        conversationId,
        conversationScenarioId,
        inputContent: content,
        profileForCharge: quotaCheck.profile,
        requestAttachments,
        streamResult,
        userMessageId: userMessage.id,
      })

      return accepted
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to complete send flow.'

      setSnapshot((currentSnapshot) => ({
        ...currentSnapshot,
        stream: {
          ...initialStreamState,
          phase: 'error',
          conversationId,
          error: message,
        },
      }))

      return accepted
    }
  }

  async function stopGeneration() {
    if (!snapshot.stream.conversationId || !snapshot.stream.assistantMessageId) {
      return
    }

    streamOutcomeRef.current = 'stopped'

    if (streamTimerRef.current) {
      window.clearInterval(streamTimerRef.current)
      streamTimerRef.current = null
    }

    streamResolverRef.current?.()
    streamResolverRef.current = null

    const stoppedAt = new Date().toISOString()
    const { conversationId, assistantMessageId } = snapshot.stream

    setSnapshot((currentSnapshot) => ({
      ...currentSnapshot,
      stream: {
        ...currentSnapshot.stream,
        phase: 'stopping',
        abortable: false,
      },
    }))

    await mockChatService.updateAssistantMessage({
      conversationId,
      messageId: assistantMessageId,
      patch: {
        status: 'stopped',
        metadata: {
          finish_reason: 'stopped',
          model: MOCK_MODEL_NAME,
        },
        updated_at: stoppedAt,
      },
    })

    setSnapshot((currentSnapshot) => ({
      ...currentSnapshot,
      messagesByConversation: {
        ...currentSnapshot.messagesByConversation,
        [conversationId]: (currentSnapshot.messagesByConversation[conversationId] ?? []).map(
          (message) =>
            message.id === assistantMessageId
              ? {
                  ...message,
                  status: 'stopped',
                  updated_at: stoppedAt,
                  metadata: {
                    finish_reason: 'stopped',
                    model: MOCK_MODEL_NAME,
                  },
                }
              : message,
        ),
      },
      stream: initialStreamState,
    }))

    if (userId) {
      await refreshConversations(userId, conversationId)
    }
  }

  async function copyMessage(content: string, messageId: string) {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(content)
    }

    setCopiedMessageId(messageId)

    if (copyTimerRef.current) {
      window.clearTimeout(copyTimerRef.current)
    }

    copyTimerRef.current = window.setTimeout(() => {
      setCopiedMessageId(null)
    }, 1500)
  }

  async function regenerateMessage(messageId: string) {
    const conversationId = snapshot.activeConversationId

    const currentProfile = profileRef.current

    if (!conversationId || isBusy || !userId || !currentProfile) {
      return
    }

    const conversationMessages = snapshot.messagesByConversation[conversationId] ?? []
    const assistantIndex = conversationMessages.findIndex(
      (message) => message.id === messageId && message.role === 'assistant',
    )

    if (assistantIndex <= 0) {
      return
    }

    const userMessage = [...conversationMessages]
      .slice(0, assistantIndex)
      .reverse()
      .find((message) => message.role === 'user')

    if (!userMessage) {
      return
    }

    const requestAttachments = prepareMessageAttachments(userMessage.attachments)
    const quotaCheck = checkQuotaBeforeSendForProfile(currentProfile)

    if (hasBillingChanges(currentProfile, quotaCheck.profile)) {
      await persistBillingProfile(quotaCheck.profile)
    }

    if (!quotaCheck.allowed) {
      setSnapshot((currentSnapshot) => ({
        ...currentSnapshot,
        stream: {
          ...initialStreamState,
          phase: 'error',
          conversationId,
          error: quotaCheck.reason,
        },
      }))
      return
    }

    try {
      const assistantDraft = await createAssistantDraft(
        conversationId,
        userMessage.id,
        messageId,
      )
      const streamResult = await runAssistantStream(
        conversationId,
        assistantDraft.id,
        userMessage.content,
        requestAttachments,
        messageId,
      )

      if (!streamResult.completed) {
        return
      }

      await finalizeSuccessfulGeneration({
        assistantMessageId: assistantDraft.id,
        conversationId,
        conversationScenarioId: activeConversation?.scenario_id ?? scenarioId,
        inputContent: userMessage.content,
        profileForCharge: quotaCheck.profile,
        requestAttachments,
        streamResult,
        userMessageId: userMessage.id,
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to regenerate response.'

      setSnapshot((currentSnapshot) => ({
        ...currentSnapshot,
        stream: {
          ...initialStreamState,
          phase: 'error',
          conversationId,
          error: message,
        },
      }))
    }
  }

  return {
    activeConversation,
    conversations: snapshot.conversations,
    isBusy,
    isLoading,
    messages,
    copiedMessageId,
    composerValue: snapshot.composer.value,
    stream: snapshot.stream,
    snapshot,
    createConversation,
    deleteConversation,
    selectConversation,
    updateComposer,
    sendMessage,
    stopGeneration,
    copyMessage,
    regenerateMessage,
  }
}
