import type { UserProfile } from '../../types/auth'

export type ScenarioId =
  | 'contract-review'
  | 'legal-research'
  | 'litigation-strategy'
  | 'legal-drafting'
  | 'due-diligence'
  | 'compliance-interpretation'
  | 'client-response'
  | 'case-analysis'
  | 'negotiation-strategy'
  | 'legal-translation'
  | 'ip-analysis'
  | 'dispute-resolution'

export type ScenarioIconKey =
  | 'file-search'
  | 'book-search'
  | 'scale'
  | 'file-pen-line'
  | 'building-2'
  | 'shield-check'
  | 'messages-square'
  | 'book-open-text'
  | 'handshake'
  | 'languages'
  | 'copyright'
  | 'route'

export type ScenarioDefinition = {
  id: ScenarioId
  name: string
  icon: ScenarioIconKey
  description: string
  system_prompt: string
}

export type ScenarioProfileSource = Pick<UserProfile, 'default_scenario_id'>

export type ScenarioResolutionInput = {
  activeScenarioId?: string | null
  defaultScenarioId?: string | null
  fallbackScenarioId?: ScenarioId
}

export type ScenarioSwitchDraft = {
  currentScenarioId: ScenarioId
  nextScenarioId: ScenarioId
  willCreateConversation: true
}
