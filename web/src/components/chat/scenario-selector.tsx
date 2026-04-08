import { ChevronRight } from 'lucide-react'

import type {
  ScenarioDefinition,
  ScenarioId,
} from '../../features/scenarios'
import { getScenarioById } from '../../features/scenarios'
import { ScenarioIcon } from './scenario-icon'

type ScenarioSelectorProps = {
  scenarios: readonly ScenarioDefinition[]
  activeScenarioId: ScenarioId
  defaultScenarioId?: ScenarioId | null
  pendingScenarioId?: ScenarioId | null
  onSelectScenario: (scenarioId: ScenarioId) => void
}

export function ScenarioSelector({
  scenarios,
  activeScenarioId,
  defaultScenarioId = null,
  pendingScenarioId = null,
  onSelectScenario,
}: ScenarioSelectorProps) {
  const activeScenario = getScenarioById(activeScenarioId) ?? scenarios[0]
  const defaultScenario =
    defaultScenarioId ? getScenarioById(defaultScenarioId) : null

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-[22px] border border-[color:var(--border)] bg-[color:var(--surface)] p-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-[color:var(--accent-soft)] p-3 text-[color:var(--accent)]">
            <ScenarioIcon icon={activeScenario.icon} className="size-5" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold text-[color:var(--text)]">
                {activeScenario.name}
              </h3>
              {defaultScenarioId === activeScenario.id ? (
                <span className="rounded-full bg-[color:var(--accent-soft)] px-2.5 py-1 text-[11px] font-medium text-[color:var(--accent-strong)]">
                  默认场景
                </span>
              ) : null}
            </div>
            <p className="text-sm leading-6 muted-copy">
              {activeScenario.description}
            </p>
          </div>
        </div>

        <div className="space-y-1 text-sm muted-copy md:max-w-xs md:text-right">
          <p>切换场景会先确认，再以前端骨架方式新建会话。</p>
          <p>
            {defaultScenario
              ? `default_scenario_id 当前读取为「${defaultScenario.name}」`
              : '当前未读取到 default_scenario_id'}
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {scenarios.map((scenario) => {
          const isActive = scenario.id === activeScenarioId
          const isDefault = scenario.id === defaultScenarioId
          const isPending = scenario.id === pendingScenarioId

          return (
            <button
              key={scenario.id}
              type="button"
              onClick={() => onSelectScenario(scenario.id)}
              className={`group flex min-h-28 flex-col rounded-[22px] border p-4 text-left transition ${
                isActive
                  ? 'border-[color:var(--accent)] bg-[color:var(--accent-soft)] shadow-[0_12px_36px_rgba(15,107,104,0.12)]'
                  : 'border-[color:var(--border)] bg-white/70 hover:border-[color:var(--border-strong)] hover:bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="rounded-2xl bg-white/80 p-2 text-[color:var(--accent)]">
                  <ScenarioIcon icon={scenario.icon} className="size-4" />
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  {isDefault ? (
                    <span className="rounded-full bg-white/80 px-2 py-1 text-[10px] font-medium text-[color:var(--accent-strong)]">
                      默认
                    </span>
                  ) : null}
                  {isActive ? (
                    <span className="rounded-full bg-[color:var(--accent)] px-2 py-1 text-[10px] font-medium text-white">
                      当前
                    </span>
                  ) : null}
                  {isPending ? (
                    <span className="rounded-full bg-[color:var(--warning)]/15 px-2 py-1 text-[10px] font-medium text-[color:var(--warning)]">
                      待确认
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2">
                  <h4 className="text-base font-semibold text-[color:var(--text)]">
                    {scenario.name}
                  </h4>
                  {!isActive ? (
                    <ChevronRight className="size-4 text-[color:var(--text-soft)] transition group-hover:translate-x-0.5" />
                  ) : null}
                </div>
                <p className="text-sm leading-6 muted-copy">
                  {scenario.description}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
