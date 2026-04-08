import { DEFAULT_SCENARIO_ID, LAW_SCENARIOS } from './scenarios'
import type {
  ScenarioDefinition,
  ScenarioId,
  ScenarioProfileSource,
  ScenarioResolutionInput,
} from './types'

const scenarioMap = new Map(
  LAW_SCENARIOS.map(
    (scenario) =>
      [scenario.id, scenario] satisfies [ScenarioId, ScenarioDefinition],
  ),
)

export function isScenarioId(value: string): value is ScenarioId {
  return scenarioMap.has(value as ScenarioId)
}

export function getScenarioById(id?: string | null) {
  if (!id || !isScenarioId(id)) {
    return undefined
  }

  return scenarioMap.get(id)
}

export function getDefaultScenarioId(profile?: ScenarioProfileSource | null) {
  const scenarioId = profile?.default_scenario_id

  return scenarioId && isScenarioId(scenarioId) ? scenarioId : null
}

export function resolveScenarioId({
  activeScenarioId,
  defaultScenarioId,
  fallbackScenarioId = DEFAULT_SCENARIO_ID,
}: ScenarioResolutionInput = {}): ScenarioId {
  if (activeScenarioId && isScenarioId(activeScenarioId)) {
    return activeScenarioId
  }

  if (defaultScenarioId && isScenarioId(defaultScenarioId)) {
    return defaultScenarioId
  }

  return fallbackScenarioId
}
