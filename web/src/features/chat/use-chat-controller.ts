import { useEffect, useRef, useState } from 'react'

import {
  checkQuotaBeforeSendForProfile,
  consumeCreditAfterSuccessForProfile,
} from '../billing/billing-service'
import { resolveSubscriptionExpiry } from '../billing/billing-rules'
import { recordUsageLog } from '../usage/usage-service'
import {
  buildChatApiPayload,
  streamChatCompletion,
} from '../../lib/ai/openrouter-client'
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
import { chatService } from './runtime-chat-service'

const FALLBACK_MODEL_NAME = 'openrouter'

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
  createConversation(scenarioId?: string): Promise<string | null>
  deleteConversation(conversationId: string): Promise<string | null>
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
  const streamAbortControllerRef = useRef<AbortController | null>(null)
  const copyTimerRef = useRef<number | null>(null)
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

      const conversations = await chatService.listConversations({
        userId,
      })

      if (disposed) {
        return
      }

      const activeConversationId = conversations[0]?.id ?? null
      const messagesByConversation: ChatStateSnapshot['messagesByConversation'] = {}

      if (activeConversationId) {
        messagesByConversation[activeConversationId] =
          await chatService.listMessages({
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
      streamAbortControllerRef.current?.abort()

      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current)
      }
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

    const messagesForConversation = await chatService.listMessages({
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
    const conversations = await chatService.listConversations({
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
      return null
    }

    const conversation = await chatService.createConversation({
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

    return conversation.id
  }

  async function deleteConversation(conversationId: string) {
    if (!userId) {
      return null
    }

    if (snapshot.stream.conversationId === conversationId && isBusy) {
      await stopGeneration()
    }

    await chatService.deleteConversation({ conversationId })
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

    return fallbackConversationId
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

    const conversations = await chatService.listConversations({
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
    requestMessages: ChatMessage[],
    requestScenarioId: string,
    regenerationOf?: string,
  ): Promise<StreamResult> {
    const startedAt = new Date().toISOString()
    let currentContent = ''
    const abortController = new AbortController()

    streamAbortControllerRef.current = abortController

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

    await chatService.updateAssistantMessage({
      conversationId,
      messageId: assistantMessageId,
      patch: {
        content: '',
        status: 'streaming',
        metadata: {
          finish_reason: 'placeholder',
          model: FALLBACK_MODEL_NAME,
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
                    model: FALLBACK_MODEL_NAME,
                    regeneration_of: regenerationOf ?? null,
                  },
                }
              : message,
        ),
      },
    }))

    try {
      const streamResult = await streamChatCompletion({
        conversationId,
        messages: buildChatApiPayload({
          conversationId,
          messages: requestMessages,
          scenarioId: requestScenarioId,
        }).messages,
        onEvent: ({ delta, modelName }) => {
          if (!delta) {
            return
          }

          currentContent += delta
          const chunkTime = new Date().toISOString()
          const resolvedModelName = modelName ?? FALLBACK_MODEL_NAME

          void chatService.updateAssistantMessage({
            conversationId,
            messageId: assistantMessageId,
            patch: {
              content: currentContent,
              status: 'streaming',
              metadata: {
                finish_reason: 'placeholder',
                model: resolvedModelName,
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
                      status: 'streaming',
                      updated_at: chunkTime,
                      metadata: {
                        finish_reason: 'placeholder',
                        model: resolvedModelName,
                        regeneration_of: regenerationOf ?? null,
                      },
                    }
                  : message,
              ),
            },
            stream: {
              ...currentSnapshot.stream,
              phase: 'streaming',
              lastChunkAt: chunkTime,
              abortable: true,
            },
          }))
        },
        scenarioId: requestScenarioId,
        signal: abortController.signal,
      })

      streamAbortControllerRef.current = null

      const finishedAt = new Date().toISOString()
      const resolvedModelName = streamResult.modelName ?? FALLBACK_MODEL_NAME

      await chatService.updateAssistantMessage({
        conversationId,
        messageId: assistantMessageId,
        patch: {
          content: streamResult.content,
          status: 'complete',
          metadata: {
            finish_reason: 'complete',
            model: resolvedModelName,
            regeneration_of: regenerationOf ?? null,
          },
          updated_at: finishedAt,
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
                  content: streamResult.content,
                  status: 'complete',
                  updated_at: finishedAt,
                  metadata: {
                    finish_reason: 'complete',
                    model: resolvedModelName,
                    regeneration_of: regenerationOf ?? null,
                  },
                }
              : message,
          ),
        },
        stream: initialStreamState,
      }))

      if (userId) {
        void refreshConversations(userId)
      }

      return {
        completed: true,
        content: streamResult.content,
        modelName: resolvedModelName,
        outputTokens:
          streamResult.usage?.completion_tokens ??
          estimateTokenCount(streamResult.content),
      }
    } catch (error) {
      streamAbortControllerRef.current = null

      if (
        abortController.signal.aborted ||
        (error instanceof DOMException && error.name === 'AbortError')
      ) {
        return {
          completed: false,
          content: currentContent,
          modelName: FALLBACK_MODEL_NAME,
          outputTokens: estimateTokenCount(currentContent),
        }
      }

      const message =
        error instanceof Error ? error.message : 'Failed to stream AI response.'
      const errorTime = new Date().toISOString()

      await chatService.updateAssistantMessage({
        conversationId,
        messageId: assistantMessageId,
        patch: {
          content: currentContent,
          error_message: message,
          status: 'error',
          metadata: {
            finish_reason: 'error',
            model: FALLBACK_MODEL_NAME,
            regeneration_of: regenerationOf ?? null,
          },
          updated_at: errorTime,
        },
      })

      setSnapshot((currentSnapshot) => ({
        ...currentSnapshot,
        messagesByConversation: {
          ...currentSnapshot.messagesByConversation,
          [conversationId]: (
            currentSnapshot.messagesByConversation[conversationId] ?? []
          ).map((entry) =>
            entry.id === assistantMessageId
              ? {
                  ...entry,
                  content: currentContent,
                  error_message: message,
                  status: 'error',
                  updated_at: errorTime,
                  metadata: {
                    finish_reason: 'error',
                    model: FALLBACK_MODEL_NAME,
                    regeneration_of: regenerationOf ?? null,
                  },
                }
              : entry,
          ),
        },
        stream: {
          ...initialStreamState,
          phase: 'error',
          conversationId,
          error: message,
        },
      }))

      throw error
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

    const assistantMessage = await chatService.createAssistantMessage({
      conversationId,
      parentMessageId,
      status: 'pending',
      metadata: {
        finish_reason: 'placeholder',
        model: FALLBACK_MODEL_NAME,
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
      const conversation = await chatService.createConversation({
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
      const userMessage = await chatService.createUserMessage({
        conversationId,
        content,
        attachments,
      })
      accepted = true

      await appendMessageToState(conversationId, userMessage)
      const requestMessages = [
        ...(snapshot.messagesByConversation[conversationId] ?? []),
        userMessage,
      ]
      const assistantDraft = await createAssistantDraft(conversationId, userMessage.id)
      const streamResult = await runAssistantStream(
        conversationId,
        assistantDraft.id,
        requestMessages,
        conversationScenarioId,
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
    streamAbortControllerRef.current?.abort()
    streamAbortControllerRef.current = null

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

    await chatService.updateAssistantMessage({
      conversationId,
      messageId: assistantMessageId,
      patch: {
        status: 'stopped',
        metadata: {
          finish_reason: 'stopped',
          model: FALLBACK_MODEL_NAME,
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
                    model: FALLBACK_MODEL_NAME,
                  },
                }
              : message,
        ),
      },
      stream: initialStreamState,
    }))

    if (userId) {
      await refreshConversations(userId)
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
      const requestMessages = conversationMessages
        .slice(0, assistantIndex)
        .filter((message) => message.role === 'user' || message.role === 'assistant')
      const streamResult = await runAssistantStream(
        conversationId,
        assistantDraft.id,
        requestMessages,
        activeConversation?.scenario_id ?? scenarioId,
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
