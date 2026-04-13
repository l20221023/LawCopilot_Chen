import type { AIRequestDecisionContext } from './chat'

export type UsageLogMetadata = {
  [Key in keyof AIRequestDecisionContext]?: AIRequestDecisionContext[Key] | null
}

export type UsageDecisionFields = {
  billing_strategy: AIRequestDecisionContext['billing_strategy'] | null
  estimated_input_tokens: AIRequestDecisionContext['estimated_input_tokens'] | null
  estimated_output_tokens: AIRequestDecisionContext['estimated_output_tokens'] | null
  estimated_total_tokens: AIRequestDecisionContext['estimated_total_tokens'] | null
  estimated_token_cost: AIRequestDecisionContext['estimated_token_cost'] | null
  estimated_fixed_cost: AIRequestDecisionContext['estimated_fixed_cost'] | null
  cached_system_prompt: AIRequestDecisionContext['cached_system_prompt'] | null
  system_prompt_hash: AIRequestDecisionContext['system_prompt_hash'] | null
}

export type UsageDecisionFieldInput = {
  billing_strategy?: AIRequestDecisionContext['billing_strategy'] | null
  estimated_input_tokens?: AIRequestDecisionContext['estimated_input_tokens'] | null
  estimated_output_tokens?: AIRequestDecisionContext['estimated_output_tokens'] | null
  estimated_total_tokens?: AIRequestDecisionContext['estimated_total_tokens'] | null
  estimated_token_cost?: AIRequestDecisionContext['estimated_token_cost'] | null
  estimated_fixed_cost?: AIRequestDecisionContext['estimated_fixed_cost'] | null
  cached_system_prompt?: AIRequestDecisionContext['cached_system_prompt'] | null
  system_prompt_hash?: AIRequestDecisionContext['system_prompt_hash'] | null
}

type UsageLogBase = {
  id: string
  user_id: string
  conversation_id: string
  user_message_id: string
  assistant_message_id: string | null
  scenario_id: string
  model_name: string
  input_tokens: number
  output_tokens: number
  total_tokens: number
  credit_cost: number
  created_at: string
}

export type UsageLog = UsageLogBase &
  UsageDecisionFields & {
    metadata?: UsageLogMetadata | null
  }

export type UsageRecordInput = Omit<
  UsageLogBase,
  'created_at' | 'id' | 'total_tokens'
> &
  UsageDecisionFieldInput & {
    metadata?: UsageLogMetadata | null
  }

export type UsageLogSummary = {
  totalCreditsConsumed: number
  totalInputTokens: number
  totalOutputTokens: number
  totalRequests: number
  totalTokens: number
}
