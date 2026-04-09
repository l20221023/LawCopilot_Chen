import { useState } from 'react'
import { ArrowRight, Clock3 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { SectionCard } from '../../components/common/section-card'
import { ScenarioIcon } from '../../components/chat/scenario-icon'
import { useAuth } from '../../features/auth/use-auth'
import { useChatRuntime } from '../../features/chat/use-chat-runtime'
import {
  LAW_SCENARIOS,
  getDefaultScenarioId,
  getScenarioById,
  resolveScenarioId,
  type ScenarioId,
} from '../../features/scenarios'
export function ChatHomePage() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const chat = useChatRuntime()
  const defaultScenarioId = getDefaultScenarioId(profile)
  const [selectedScenarioId, setSelectedScenarioId] = useState<ScenarioId>(() =>
    resolveScenarioId({ defaultScenarioId }),
  )
  const [actionError, setActionError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const recentConversations = chat.conversations
  const isLoadingConversations = chat.isLoading

  async function handleStartWorkspace() {
    if (!profile || isCreating) {
      return
    }

    setIsCreating(true)
    setActionError(null)

    try {
      const conversationId = await chat.createConversation(selectedScenarioId)

      if (!conversationId) {
        throw new Error('Failed to create conversation.')
      }

      navigate(`/app/chat/${conversationId}`)
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Failed to create conversation.',
      )
      setIsCreating(false)
    }
  }

  if (!profile) {
    return (
      <SectionCard
        title="Profile unavailable"
        description="Chat entry needs the authenticated user profile before creating a workspace."
      >
        <div className="rounded-[18px] border border-[color:var(--border-strong)] bg-white/80 p-4 text-sm leading-6 muted-copy">
          Sign in successfully and ensure the public.users row is available
          before creating or restoring a chat workspace.
        </div>
      </SectionCard>
    )
  }

  return (
    <div className="space-y-6">
      <header className="section-card flex flex-col gap-4 p-5 md:p-6">
        <div className="space-y-2">
          <span className="eyebrow">Chat</span>
          <h1 className="page-title">Choose a legal workspace</h1>
          <p className="max-w-3xl text-sm leading-7 muted-copy md:text-base">
            Start from a scenario first. Once a workspace is created, the chat
            page focuses on the conversation itself instead of mixing scenario
            selection and message flow on one screen.
          </p>
        </div>

        <div className="rounded-[20px] border border-[color:var(--border)] bg-white/85 px-4 py-3 text-sm leading-6 text-[color:var(--text)]">
          User: {profile.nickname} · Default scenario:{' '}
          {getScenarioById(resolveScenarioId({ defaultScenarioId }))?.name}
        </div>
      </header>

      {actionError ? (
        <div className="rounded-[18px] border border-[color:var(--warning)]/40 bg-[rgba(181,106,27,0.12)] px-4 py-3 text-sm leading-6 text-[color:var(--text)]">
          {actionError}
        </div>
      ) : null}

      <SectionCard
        title="Start a new workspace"
        description="Choose the scenario that should define the initial system prompt and conversation context."
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {LAW_SCENARIOS.map((scenario) => {
              const isActive = scenario.id === selectedScenarioId

              return (
                <button
                  key={scenario.id}
                  type="button"
                  onClick={() => setSelectedScenarioId(scenario.id)}
                  className={[
                    'rounded-[24px] border px-4 py-4 text-left transition',
                    isActive
                      ? 'border-[color:var(--accent)] bg-[color:var(--accent-soft)]'
                      : 'border-[color:var(--border)] bg-white/80 hover:border-[color:var(--border-strong)] hover:bg-white',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="rounded-[16px] border border-[color:var(--border)] bg-white/80 p-3 text-[color:var(--accent)]">
                      <ScenarioIcon icon={scenario.icon} className="h-5 w-5" />
                    </div>
                    {isActive ? (
                      <span className="mono-label text-[color:var(--accent)]">
                        Selected
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-4 font-medium text-[color:var(--text)]">
                    {scenario.name}
                  </div>
                  <p className="mt-2 text-sm leading-6 muted-copy">
                    {scenario.description}
                  </p>
                </button>
              )
            })}
          </div>

          <div className="rounded-[24px] border border-[color:var(--border)] bg-white/90 p-5">
            <div className="mono-label text-[color:var(--accent)]">Selected scenario</div>
            <div className="mt-3 text-xl font-semibold text-[color:var(--text)]">
              {getScenarioById(selectedScenarioId)?.name}
            </div>
            <p className="mt-2 text-sm leading-6 muted-copy">
              {getScenarioById(selectedScenarioId)?.description}
            </p>

            <button
              type="button"
              onClick={() => void handleStartWorkspace()}
              disabled={isCreating}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-medium text-white transition hover:bg-[color:var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ArrowRight className="h-4 w-4" />
              {isCreating ? 'Creating workspace...' : 'Open workspace'}
            </button>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Recent workspaces"
        description="Resume an existing conversation directly."
      >
        {isLoadingConversations ? (
          <div className="rounded-[20px] border border-dashed border-[color:var(--border-strong)] bg-white/70 p-5 text-sm leading-6 muted-copy">
            Loading conversations...
          </div>
        ) : recentConversations.length > 0 ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {recentConversations.map((conversation) => {
              const scenario = getScenarioById(
                resolveScenarioId({ activeScenarioId: conversation.scenario_id }),
              )

              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => navigate(`/app/chat/${conversation.id}`)}
                  className="rounded-[22px] border border-[color:var(--border)] bg-white/80 p-4 text-left transition hover:border-[color:var(--border-strong)] hover:bg-white"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="font-medium text-[color:var(--text)]">
                        {conversation.title}
                      </div>
                      <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-white/80 px-3 py-1 text-xs text-[color:var(--text-soft)]">
                        <ScenarioIcon
                          icon={scenario?.icon ?? LAW_SCENARIOS[0].icon}
                          className="h-3.5 w-3.5"
                        />
                        {scenario?.name ?? conversation.scenario_id}
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs text-[color:var(--text-soft)]">
                      <Clock3 className="h-3.5 w-3.5" />
                      {new Date(conversation.updated_at).toLocaleString('zh-CN', {
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 muted-copy">
                    {conversation.last_message_preview ?? 'No messages yet.'}
                  </p>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="rounded-[20px] border border-dashed border-[color:var(--border-strong)] bg-white/70 p-5 text-sm leading-6 muted-copy">
            No existing workspaces yet. Create the first one from a scenario
            above.
          </div>
        )}
      </SectionCard>
    </div>
  )
}
