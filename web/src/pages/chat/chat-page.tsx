import { useState } from 'react'

import { SectionCard } from '../../components/common/section-card'
import { ChatComposer } from '../../components/chat/chat-composer'
import { ConversationSidebar } from '../../components/chat/conversation-sidebar'
import { MessageStream } from '../../components/chat/message-stream'
import { ScenarioSelector } from '../../components/chat/scenario-selector'
import { ScenarioSwitchConfirmDialog } from '../../components/chat/scenario-switch-confirm-dialog'
import { useAuth } from '../../features/auth/use-auth'
import { useChatComposer } from '../../features/chat/use-chat-composer'
import { useChatController } from '../../features/chat/use-chat-controller'
import {
  LAW_SCENARIOS,
  getDefaultScenarioId,
  getScenarioById,
  resolveScenarioId,
  type ScenarioId,
  type ScenarioSwitchDraft,
} from '../../features/scenarios'

export function ChatPage() {
  const { profile, updateProfile } = useAuth()
  const composer = useChatComposer()
  const defaultScenarioId = getDefaultScenarioId(profile)
  const [preferredScenarioId, setPreferredScenarioId] = useState<ScenarioId>(() =>
    resolveScenarioId({ defaultScenarioId }),
  )
  const chat = useChatController({
    profile,
    scenarioId: preferredScenarioId,
    updateProfile,
  })
  const [switchDraft, setSwitchDraft] = useState<ScenarioSwitchDraft | null>(null)
  const activeScenarioId = resolveScenarioId({
    activeScenarioId: chat.activeConversation?.scenario_id ?? preferredScenarioId,
    defaultScenarioId,
  })

  const activeScenario = getScenarioById(activeScenarioId) ?? LAW_SCENARIOS[0]
  const nextScenario = getScenarioById(switchDraft?.nextScenarioId)

  function handleSelectScenario(nextScenarioId: ScenarioId) {
    if (nextScenarioId === activeScenarioId) {
      return
    }

    setSwitchDraft({
      currentScenarioId: activeScenarioId,
      nextScenarioId,
      willCreateConversation: true,
    })
  }

  function handleCancelSwitch() {
    setSwitchDraft(null)
  }

  async function handleConfirmSwitch() {
    if (!switchDraft) {
      return
    }

    await chat.createConversation(switchDraft.nextScenarioId)
    setPreferredScenarioId(switchDraft.nextScenarioId)
    setSwitchDraft(null)
  }

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

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <header className="section-card p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-2">
              <span className="eyebrow">Workspace</span>
              <div>
                <h1 className="page-title">Chat workspace</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 muted-copy">
                  Scenario selection now binds to the authenticated profile, and
                  the send flow runs quota check, usage logging, and post-success
                  credit deduction around the mock stream.
                </p>
              </div>
            </div>

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
            onCreateConversation={() => chat.createConversation(activeScenarioId)}
            onDeleteConversation={chat.deleteConversation}
            onSelectConversation={chat.selectConversation}
          />

          <div className="flex min-h-0 flex-col gap-4">
            <section className="section-card p-4 md:p-5">
              <div className="mono-label text-[color:var(--accent)]">
                Scenario selector
              </div>
              <div className="mt-4">
                <ScenarioSelector
                  scenarios={LAW_SCENARIOS}
                  activeScenarioId={activeScenario.id}
                  defaultScenarioId={defaultScenarioId}
                  pendingScenarioId={switchDraft?.nextScenarioId ?? null}
                  onSelectScenario={handleSelectScenario}
                />
              </div>
            </section>

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

      <ScenarioSwitchConfirmDialog
        switchDraft={switchDraft}
        currentScenario={activeScenario}
        nextScenario={nextScenario ?? null}
        onCancel={handleCancelSwitch}
        onConfirm={handleConfirmSwitch}
      />
    </>
  )
}
