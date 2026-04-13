import { supabase } from './client'
import { SupabaseServiceError } from './errors'
import type {
  UsageDecisionFields,
  UsageLog,
  UsageLogMetadata,
  UsageRecordInput,
} from '../../types/usage'

const baseUsageColumns = [
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
]

const decisionUsageColumns = [
  'billing_strategy',
  'estimated_input_tokens',
  'estimated_output_tokens',
  'estimated_total_tokens',
  'estimated_token_cost',
  'estimated_fixed_cost',
  'cached_system_prompt',
  'system_prompt_hash',
]

const usageColumns = [...baseUsageColumns, ...decisionUsageColumns].join(', ')

function getSupabaseClient() {
  if (!supabase) {
    throw new SupabaseServiceError(
      'SUPABASE_NOT_CONFIGURED',
      'Supabase env vars are missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY first.',
    )
  }

  return supabase
}

function normalizeUsageDecisionFields(input: {
  billing_strategy?: UsageLog['billing_strategy']
  estimated_input_tokens?: UsageLog['estimated_input_tokens']
  estimated_output_tokens?: UsageLog['estimated_output_tokens']
  estimated_total_tokens?: UsageLog['estimated_total_tokens']
  estimated_token_cost?: UsageLog['estimated_token_cost']
  estimated_fixed_cost?: UsageLog['estimated_fixed_cost']
  cached_system_prompt?: UsageLog['cached_system_prompt']
  system_prompt_hash?: UsageLog['system_prompt_hash']
  metadata?: UsageLogMetadata | null
}): UsageDecisionFields {
  const metadata = input.metadata ?? null

  return {
    billing_strategy: input.billing_strategy ?? metadata?.billing_strategy ?? null,
    estimated_input_tokens:
      input.estimated_input_tokens ?? metadata?.estimated_input_tokens ?? null,
    estimated_output_tokens:
      input.estimated_output_tokens ?? metadata?.estimated_output_tokens ?? null,
    estimated_total_tokens:
      input.estimated_total_tokens ?? metadata?.estimated_total_tokens ?? null,
    estimated_token_cost:
      input.estimated_token_cost ?? metadata?.estimated_token_cost ?? null,
    estimated_fixed_cost:
      input.estimated_fixed_cost ?? metadata?.estimated_fixed_cost ?? null,
    cached_system_prompt:
      input.cached_system_prompt ?? metadata?.cached_system_prompt ?? null,
    system_prompt_hash: input.system_prompt_hash ?? metadata?.system_prompt_hash ?? null,
  }
}

function buildUsageMetadata(
  decisionFields: UsageDecisionFields,
  metadata?: UsageLogMetadata | null,
) {
  const resolvedMetadata: UsageLogMetadata = {
    ...metadata,
    ...decisionFields,
  }

  return Object.values(resolvedMetadata).some(
    (value) => value !== null && value !== undefined,
  )
    ? resolvedMetadata
    : null
}

function normalizeUsageLog(
  row: unknown,
  metadataFallback: UsageLog['metadata'] = null,
): UsageLog {
  const typedRow = row as UsageLog & {
    metadata?: UsageLogMetadata | null
  }
  const decisionFields = normalizeUsageDecisionFields({
    billing_strategy: typedRow.billing_strategy,
    cached_system_prompt: typedRow.cached_system_prompt,
    estimated_fixed_cost: typedRow.estimated_fixed_cost,
    estimated_input_tokens: typedRow.estimated_input_tokens,
    estimated_output_tokens: typedRow.estimated_output_tokens,
    estimated_token_cost: typedRow.estimated_token_cost,
    estimated_total_tokens: typedRow.estimated_total_tokens,
    metadata: typedRow.metadata ?? metadataFallback ?? null,
    system_prompt_hash: typedRow.system_prompt_hash,
  })

  return {
    assistant_message_id: typedRow.assistant_message_id ?? null,
    billing_strategy: decisionFields.billing_strategy,
    cached_system_prompt: decisionFields.cached_system_prompt,
    conversation_id: typedRow.conversation_id,
    created_at: typedRow.created_at,
    credit_cost: typedRow.credit_cost,
    estimated_fixed_cost: decisionFields.estimated_fixed_cost,
    estimated_input_tokens: decisionFields.estimated_input_tokens,
    estimated_output_tokens: decisionFields.estimated_output_tokens,
    estimated_token_cost: decisionFields.estimated_token_cost,
    estimated_total_tokens: decisionFields.estimated_total_tokens,
    id: typedRow.id,
    input_tokens: typedRow.input_tokens,
    metadata: buildUsageMetadata(decisionFields, typedRow.metadata ?? metadataFallback ?? null),
    model_name: typedRow.model_name,
    output_tokens: typedRow.output_tokens,
    scenario_id: typedRow.scenario_id,
    system_prompt_hash: decisionFields.system_prompt_hash,
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
  const decisionFields = normalizeUsageDecisionFields(input)
  const basePayload = {
    assistant_message_id: input.assistant_message_id ?? null,
    billing_strategy: decisionFields.billing_strategy,
    cached_system_prompt: decisionFields.cached_system_prompt,
    conversation_id: input.conversation_id,
    created_at: new Date().toISOString(),
    credit_cost: input.credit_cost,
    estimated_fixed_cost: decisionFields.estimated_fixed_cost,
    estimated_input_tokens: decisionFields.estimated_input_tokens,
    estimated_output_tokens: decisionFields.estimated_output_tokens,
    estimated_token_cost: decisionFields.estimated_token_cost,
    estimated_total_tokens: decisionFields.estimated_total_tokens,
    id: crypto.randomUUID(),
    input_tokens: input.input_tokens,
    model_name: input.model_name,
    output_tokens: input.output_tokens,
    scenario_id: input.scenario_id,
    system_prompt_hash: decisionFields.system_prompt_hash,
    total_tokens: input.input_tokens + input.output_tokens,
    user_id: input.user_id,
    user_message_id: input.user_message_id,
  }
  const { data, error } = await client
    .from('usage_logs')
    .insert(basePayload)
    .select(usageColumns)
    .single()

  if (error) {
    throw error
  }

  return normalizeUsageLog(
    data,
    buildUsageMetadata(decisionFields, input.metadata ?? null),
  )
}
