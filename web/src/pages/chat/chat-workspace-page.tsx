import { ArrowLeft } from 'lucide-react'
import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { ChatComposer } from '../../components/chat/chat-composer'
import { MessageStream } from '../../components/chat/message-stream'
import { useAuth } from '../../features/auth/use-auth'
import { useChatComposer } from '../../features/chat/use-chat-composer'
import { useChatRuntime } from '../../features/chat/use-chat-runtime'
import {
  LAW_SCENARIOS,
  getDefaultScenarioId,
  getScenarioById,
  resolveScenarioId,
} from '../../features/scenarios'

function resolveConversationDisplayTitle(title?: string | null, preview?: string | null) {
  const normalizedTitle = title?.trim() ?? ''

  if (
    normalizedTitle &&
    normalizedTitle !== 'New conversation' &&
    normalizedTitle !== '新建会话' &&
    normalizedTitle !== '新对话'
  ) {
    return normalizedTitle
  }

  if (preview?.trim()) {
    return preview.trim().slice(0, 24)
  }

  return '新建会话'
}

function getStreamPhaseLabel(phase: ReturnType<typeof useChatRuntime>['stream']['phase']) {
  switch (phase) {
    case 'submitting':
      return '正在提交'
    case 'preparing-assistant':
      return '准备回复'
    case 'streaming':
      return '正在生成'
    case 'stopping':
      return '正在停止'
    case 'error':
      return '异常'
    default:
      return '就绪'
  }
}

export function ChatWorkspacePage() {
  const navigate = useNavigate()
  const { conversationId } = useParams<{ conversationId: string }>()
  const { profile } = useAuth()
  const composer = useChatComposer()
  const defaultScenarioId = getDefaultScenarioId(profile)
  const chat = useChatRuntime()
  const activeConversationId = chat.activeConversation?.id ?? null
  const conversations = chat.conversations
  const isLoading = chat.isLoading
  const selectConversation = chat.selectConversation

  useEffect(() => {
    if (!conversationId || isLoading) {
      return
    }

    const conversationExists = conversations.some(
      (conversation) => conversation.id === conversationId,
    )

    if (!conversationExists) {
      navigate('/app/chat', { replace: true })
      return
    }

    if (activeConversationId !== conversationId) {
      void selectConversation(conversationId)
    }
  }, [
    activeConversationId,
    conversations,
    conversationId,
    isLoading,
    navigate,
    selectConversation,
  ])

  async function handleSend() {
    const submission = composer.captureSubmission(chat.composerValue)
    const accepted = await chat.sendMessage(
      composer.messageAttachments,
      submission.request_attachments,
    )

    if (accepted) {
      composer.clearComposer()
    }
  }

  const activeScenarioId = resolveScenarioId({
    activeScenarioId: chat.activeConversation?.scenario_id,
    defaultScenarioId,
  })
  const activeScenario = getScenarioById(activeScenarioId) ?? LAW_SCENARIOS[0]

  if (!profile || !conversationId) {
    return null
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 flex-col items-center gap-3 px-1 pb-4 text-center">
        <button
          type="button"
          onClick={() => navigate('/app/chat')}
          className="inline-flex items-center gap-2 self-start text-sm muted-copy transition hover:text-[color:var(--text)]"
        >
          <ArrowLeft className="h-4 w-4" />
          返回场景选择
        </button>

        <h1 className="max-w-3xl text-center text-xl font-semibold text-[color:var(--text)] md:text-2xl">
          {resolveConversationDisplayTitle(
            chat.activeConversation?.title,
            chat.activeConversation?.last_message_preview,
          )}
        </h1>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-[color:var(--surface-muted)] px-3 py-1 text-xs text-[color:var(--text-soft)]">
            <span>当前场景</span>
            <span className="font-medium text-[color:var(--text)]">
              {activeScenario.name}
            </span>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-[color:var(--surface-muted)] px-3 py-1 text-xs text-[color:var(--text-soft)]">
            <span>当前状态</span>
            <span className="font-medium text-[color:var(--text)]">
              {getStreamPhaseLabel(chat.stream.phase)}
            </span>
          </div>
        </div>
      </header>

      {chat.stream.error ? (
        <div className="mb-3 shrink-0 rounded-[18px] bg-[rgba(201,124,34,0.1)] px-4 py-3 text-sm leading-6 text-[color:var(--warning)]">
          {chat.stream.error}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <MessageStream
          copiedMessageId={chat.copiedMessageId}
          isLoading={chat.isLoading}
          messages={chat.messages}
          stream={chat.stream}
          onCopy={chat.copyMessage}
          onRegenerate={chat.regenerateMessage}
        />

        <div className="shrink-0">
          <ChatComposer
            attachments={composer.attachments}
            attachmentErrorMessage={composer.errorMessage}
            isAttaching={composer.isAttaching}
            isBusy={chat.isBusy}
            streamError={chat.stream.error}
            streamPhase={chat.stream.phase}
            value={chat.composerValue}
            onAddAttachments={composer.addFiles}
            onChange={chat.updateComposer}
            onClearAttachments={composer.clearComposer}
            onRemoveAttachment={composer.removeAttachment}
            onSend={handleSend}
            onStop={chat.stopGeneration}
          />
        </div>
      </div>
    </div>
  )
}
