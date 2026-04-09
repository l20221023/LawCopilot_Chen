import { useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'

import { ChatComposer } from '../../components/chat/chat-composer'
import { ConversationSidebar } from '../../components/chat/conversation-sidebar'
import { MessageStream } from '../../components/chat/message-stream'
import { SectionCard } from '../../components/common/section-card'
import { useAuth } from '../../features/auth/use-auth'
import { useChatComposer } from '../../features/chat/use-chat-composer'
import { useChatRuntime } from '../../features/chat/use-chat-runtime'
import {
  LAW_SCENARIOS,
  getDefaultScenarioId,
  getScenarioById,
  resolveScenarioId,
} from '../../features/scenarios'

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
    isLoading,
    conversationId,
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

  async function handleDeleteConversation(targetConversationId: string) {
    const fallbackConversationId = await chat.deleteConversation(targetConversationId)

    if (targetConversationId !== conversationId) {
      return
    }

    if (fallbackConversationId) {
      navigate(`/app/chat/${fallbackConversationId}`, { replace: true })
      return
    }

    navigate('/app/chat', { replace: true })
  }

  async function handleSelectConversation(targetConversationId: string) {
    await chat.selectConversation(targetConversationId)
    navigate(`/app/chat/${targetConversationId}`)
  }

  const activeScenarioId = resolveScenarioId({
    activeScenarioId: chat.activeConversation?.scenario_id,
    defaultScenarioId,
  })
  const activeScenario = getScenarioById(activeScenarioId) ?? LAW_SCENARIOS[0]

  if (!profile) {
    return (
      <SectionCard
        title="Profile unavailable"
        description="Chat needs the authenticated user profile to bind scenario defaults, quota checks, and usage logs."
      >
        <div className="rounded-[18px] border border-[color:var(--border-strong)] bg-white/80 p-4 text-sm leading-6 muted-copy">
          Sign in successfully and make sure the public.users row is available
          before testing the integrated chat flow.
        </div>
      </SectionCard>
    )
  }

  if (!conversationId) {
    return null
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <header className="section-card p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <span className="eyebrow">Workspace</span>
            <div>
              <h1 className="page-title">{activeScenario.name}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 muted-copy">
                This workspace focuses on a single conversation. To switch to a
                different scenario, go back and start a new workspace from the
                chat entry page.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-[20px] border border-[color:var(--border)] bg-white/85 px-4 py-3">
              <div className="mono-label text-[color:var(--accent)]">
                Active context
              </div>
              <div className="mt-2 text-sm font-medium text-[color:var(--text)]">
                {activeScenario.name}
              </div>
              <p className="mt-1 text-xs leading-5 muted-copy">
                User: {profile.nickname}
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate('/app/chat')}
              className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-white/85 px-4 py-3 text-sm font-medium text-[color:var(--text)] transition hover:border-[color:var(--border-strong)] hover:bg-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to scenarios
            </button>
          </div>
        </div>
      </header>

      {chat.stream.error ? (
        <div className="rounded-[18px] border border-[color:var(--warning)]/40 bg-[rgba(181,106,27,0.12)] px-4 py-3 text-sm leading-6 text-[color:var(--text)]">
          {chat.stream.error}
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <ConversationSidebar
          activeConversationId={chat.activeConversation?.id ?? null}
          conversations={chat.conversations}
          isBusy={chat.isBusy}
          createLabel="Choose another scenario"
          description="Open another saved workspace, or go back to the entry page to start a new scenario."
          onCreateConversation={async () => {
            navigate('/app/chat')
            return null
          }}
          onDeleteConversation={handleDeleteConversation}
          onSelectConversation={handleSelectConversation}
          title="Saved workspaces"
        />

        <div className="flex min-h-0 flex-col gap-4">
          <MessageStream
            activeConversation={chat.activeConversation}
            copiedMessageId={chat.copiedMessageId}
            isLoading={chat.isLoading}
            messages={chat.messages}
            stream={chat.stream}
            onCopy={chat.copyMessage}
            onRegenerate={chat.regenerateMessage}
          />

          <ChatComposer
            attachments={composer.attachments}
            attachmentErrorMessage={composer.errorMessage}
            attachmentRequestPreview={composer.preparedAttachments}
            isAttaching={composer.isAttaching}
            isBusy={chat.isBusy}
            lastSubmittedRequest={composer.submittedState}
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
