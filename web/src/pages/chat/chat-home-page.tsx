import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ScenarioIcon } from '../../components/chat/scenario-icon'
import { useAuth } from '../../features/auth/use-auth'
import { useChatRuntime } from '../../features/chat/use-chat-runtime'
import { LAW_SCENARIOS } from '../../features/scenarios'

export function ChatHomePage() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const chat = useChatRuntime()
  const [actionError, setActionError] = useState<string | null>(null)
  const [creatingScenarioId, setCreatingScenarioId] = useState<string | null>(null)

  async function handleCreateConversation(scenarioId: string) {
    if (!profile || creatingScenarioId) {
      return
    }

    setCreatingScenarioId(scenarioId)
    setActionError(null)

    try {
      const conversationId = await chat.createConversation(scenarioId)

      if (!conversationId) {
        throw new Error('创建对话失败。')
      }

      navigate(`/app/chat/${conversationId}`)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '创建对话失败。')
      setCreatingScenarioId(null)
    }
  }

  if (!profile) {
    return null
  }

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center px-2 py-8 text-center">
        <div className="max-w-3xl space-y-4">
          <h1 className="display-title">请选择一个法律场景，开始新的对话</h1>
          <p className="text-base leading-8 muted-copy">
            每个会话在创建时绑定一个固定场景。进入会话后场景不会再切换；如果你需要新的场景，请重新新建对话。
          </p>
        </div>

        <div className="mt-8 grid w-full gap-3 md:grid-cols-2 xl:grid-cols-3">
          {LAW_SCENARIOS.map((scenario) => {
            const isCreating = creatingScenarioId === scenario.id

            return (
              <button
                key={scenario.id}
                type="button"
                onClick={() => void handleCreateConversation(scenario.id)}
                disabled={Boolean(creatingScenarioId)}
                className="rounded-[22px] border border-[color:var(--border)] bg-white px-4 py-4 text-left transition hover:border-[color:var(--border-strong)] hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="rounded-2xl bg-[color:var(--surface-muted)] p-3 text-[color:var(--accent)]">
                    <ScenarioIcon icon={scenario.icon} className="h-5 w-5" />
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--surface-muted)] px-3 py-1 text-xs text-[color:var(--text-soft)]">
                    <ArrowRight className="h-3.5 w-3.5" />
                    {isCreating ? '正在创建' : '进入会话'}
                  </span>
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

        {actionError ? (
          <div className="mt-5 w-full max-w-xl rounded-[18px] bg-[rgba(201,124,34,0.1)] px-4 py-3 text-sm leading-6 text-[color:var(--warning)]">
            {actionError}
          </div>
        ) : null}
      </div>
    </div>
  )
}
