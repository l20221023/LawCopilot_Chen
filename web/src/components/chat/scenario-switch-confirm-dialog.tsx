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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(17,24,39,0.36)] px-4 py-6">
      <div className="w-full max-w-md rounded-[24px] border border-[color:var(--border)] bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.16)]">
        <div className="space-y-4">
          <div className="space-y-2">
            <span className="eyebrow">场景切换</span>
            <h2 className="text-2xl font-semibold tracking-tight text-[color:var(--text)]">
              切换场景并新建对话
            </h2>
            <p className="text-sm leading-6 muted-copy">
              确认后会保留当前对话，并创建一个新的会话应用目标场景的 system
              prompt。
            </p>
          </div>

          <div className="grid gap-3">
            <div className="rounded-[18px] border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-4">
              <div className="flex items-center gap-3">
                <ScenarioIcon
                  icon={currentScenario.icon}
                  className="h-5 w-5 text-[color:var(--text-soft)]"
                />
                <div>
                  <div className="text-xs muted-copy">当前场景</div>
                  <div className="text-sm font-medium text-[color:var(--text)]">
                    {currentScenario.name}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[18px] border border-[color:var(--accent)] bg-[color:var(--accent-soft)] p-4">
              <div className="flex items-center gap-3">
                <ScenarioIcon
                  icon={nextScenario.icon}
                  className="h-5 w-5 text-[color:var(--accent)]"
                />
                <div>
                  <div className="text-xs text-[color:var(--accent-strong)]/70">
                    目标场景
                  </div>
                  <div className="text-sm font-medium text-[color:var(--text)]">
                    {nextScenario.name}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full border border-[color:var(--border-strong)] px-4 py-2 text-sm font-medium text-[color:var(--text)] transition hover:bg-[color:var(--surface-muted)]"
            >
              取消
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="rounded-full bg-[color:var(--text)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[color:var(--accent-strong)]"
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
