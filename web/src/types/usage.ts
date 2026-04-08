export type UsageLog = {
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

export type UsageRecordInput = Omit<UsageLog, 'created_at' | 'id' | 'total_tokens'>

export type UsageLogSummary = {
  totalCreditsConsumed: number
  totalInputTokens: number
  totalOutputTokens: number
  totalRequests: number
  totalTokens: number
}
