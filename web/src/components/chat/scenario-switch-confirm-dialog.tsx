import { useEffect } from 'react'
import { createPortal } from 'react-dom'

import type {
  ScenarioDefinition,
  ScenarioSwitchDraft,
} from '../../features/scenarios'
import { ScenarioIcon } from './scenario-icon'

type ScenarioSwitchConfirmDialogProps = {
  switchDraft: ScenarioSwitchDraft | null
  currentScenario: ScenarioDefinition
  nextScenario: ScenarioDefinition | null
  onCancel: () => void
  onConfirm: () => void
}

export function ScenarioSwitchConfirmDialog({
  switchDraft,
  currentScenario,
  nextScenario,
  onCancel,
  onConfirm,
}: ScenarioSwitchConfirmDialogProps) {
  const isOpen = Boolean(switchDraft && nextScenario)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  if (!switchDraft || !nextScenario) {
    return null
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(24,33,38,0.42)] px-4 py-6">
      <div className="w-full max-w-lg rounded-[28px] border border-[color:var(--border)] bg-[color:var(--background-strong)] p-6 shadow-[0_24px_80px_rgba(28,42,48,0.24)]">
        <div className="space-y-4">
          <div className="space-y-2">
            <span className="eyebrow">Scenario Switch</span>
            <h2 className="text-2xl font-semibold tracking-tight text-[color:var(--text)]">
              切换场景并新建会话
            </h2>
            <p className="text-sm leading-6 muted-copy">
              当前骨架会在确认后切换 `scenario_id`，并重新生成一个新的会话容器；旧会话保留给后续 Session 6 接入真实历史列表。
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
            <div className="rounded-[20px] border border-[color:var(--border)] bg-white/80 p-4">
              <div className="flex items-center gap-3">
                <ScenarioIcon
                  icon={currentScenario.icon}
                  className="size-5 text-[color:var(--text-soft)]"
                />
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] muted-copy">
                    当前场景
                  </p>
                  <p className="text-sm font-medium text-[color:var(--text)]">
                    {currentScenario.name}
                  </p>
                </div>
              </div>
            </div>

            <div className="mx-auto rounded-full bg-[color:var(--accent-soft)] px-3 py-1 text-xs font-medium text-[color:var(--accent-strong)]">
              新建会话
            </div>

            <div className="rounded-[20px] border border-[color:var(--accent)] bg-[color:var(--accent-soft)] p-4">
              <div className="flex items-center gap-3">
                <ScenarioIcon
                  icon={nextScenario.icon}
                  className="size-5 text-[color:var(--accent)]"
                />
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-[color:var(--accent-strong)]/75">
                    目标场景
                  </p>
                  <p className="text-sm font-medium text-[color:var(--text)]">
                    {nextScenario.name}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[20px] border border-dashed border-[color:var(--border-strong)] bg-white/75 p-4 text-sm leading-6 muted-copy">
            确认后仅更新前端状态，不会写入后端，也不会触发 AI 请求。
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full border border-[color:var(--border-strong)] px-4 py-2 text-sm font-medium text-[color:var(--text)] transition hover:bg-white"
            >
              取消
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="rounded-full bg-[color:var(--accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[color:var(--accent-strong)]"
            >
              确认切换
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
