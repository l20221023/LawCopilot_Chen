import { supabase } from './client'
import { SupabaseServiceError } from './errors'
import type { UsageLog, UsageRecordInput } from '../../types/usage'

const usageColumns = [
  'id',
  'user_id',
  'conversation_id',
  'user_message_id',
  'assistant_message_id',
  'scenario_id',
  'model_name',
  'input_tokens',
  'output_tokens',
  'total_tokens',
  'credit_cost',
  'created_at',
].join(', ')

function getSupabaseClient() {
  if (!supabase) {
    throw new SupabaseServiceError(
      'SUPABASE_NOT_CONFIGURED',
      'Supabase env vars are missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY first.',
    )
  }

  return supabase
}

function normalizeUsageLog(row: unknown): UsageLog {
  const typedRow = row as UsageLog

  return {
    assistant_message_id: typedRow.assistant_message_id ?? null,
    conversation_id: typedRow.conversation_id,
    created_at: typedRow.created_at,
    credit_cost: typedRow.credit_cost,
    id: typedRow.id,
    input_tokens: typedRow.input_tokens,
    model_name: typedRow.model_name,
    output_tokens: typedRow.output_tokens,
    scenario_id: typedRow.scenario_id,
    total_tokens: typedRow.total_tokens,
    user_id: typedRow.user_id,
    user_message_id: typedRow.user_message_id,
  }
}

export async function listSupabaseUsageLogs(limit = 10, userId?: string | null) {
  const client = getSupabaseClient()
  let query = client
    .from('usage_logs')
    .select(usageColumns)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (userId) {
    query = query.eq('user_id', userId)
  }

  const { data, error } = await query

  if (error) {
    throw error
  }

  return (data ?? []).map((row) => normalizeUsageLog(row))
}

export async function createSupabaseUsageLog(input: UsageRecordInput) {
  const client = getSupabaseClient()
  const payload = {
    assistant_message_id: input.assistant_message_id ?? null,
    conversation_id: input.conversation_id,
    created_at: new Date().toISOString(),
    credit_cost: input.credit_cost,
    id: crypto.randomUUID(),
    input_tokens: input.input_tokens,
    model_name: input.model_name,
    output_tokens: input.output_tokens,
    scenario_id: input.scenario_id,
    total_tokens: input.input_tokens + input.output_tokens,
    user_id: input.user_id,
    user_message_id: input.user_message_id,
  }

  const { data, error } = await client
    .from('usage_logs')
    .insert(payload)
    .select(usageColumns)
    .single()

  if (error) {
    throw error
  }

  return normalizeUsageLog(data)
}
