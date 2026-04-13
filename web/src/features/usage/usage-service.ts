import type {
  UsageDecisionFields,
  UsageLog,
  UsageLogMetadata,
  UsageLogSummary,
  UsageRecordInput,
} from '../../types/usage'
import { isSupabaseConfigured } from '../../lib/supabase/client'
import {
  createSupabaseUsageLog,
  listSupabaseUsageLogs,
} from '../../lib/supabase/usage'

const USAGE_STORAGE_KEY = 'lawcopilot-usage-logs'
const listeners = new Set<() => void>()

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === USAGE_STORAGE_KEY) {
      emitUsageChange()
    }
  })
}

function emitUsageChange() {
  listeners.forEach((listener) => listener())
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

function normalizeStoredUsageLog(log: UsageLog) {
  const decisionFields = normalizeUsageDecisionFields(log)

  return {
    ...log,
    ...decisionFields,
    metadata: buildUsageMetadata(decisionFields, log.metadata ?? null),
  }
}

function readStoredUsageLogs() {
  if (typeof window === 'undefined') {
    return [] as UsageLog[]
  }

  const rawValue = window.localStorage.getItem(USAGE_STORAGE_KEY)

  if (!rawValue) {
    return []
  }

  try {
    return (JSON.parse(rawValue) as UsageLog[]).map((log) =>
      normalizeStoredUsageLog(log),
    )
  } catch {
    return []
  }
}

function writeStoredUsageLogs(logs: UsageLog[]) {
  if (typeof window === 'undefined') {
    return logs
  }

  window.localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(logs))
  emitUsageChange()

  return logs
}

export function subscribeUsageLogs(listener: () => void) {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

export async function listUsageLogs(limit = 10, userId?: string | null) {
  if (isSupabaseConfigured) {
    return listSupabaseUsageLogs(limit, userId)
  }

  return readStoredUsageLogs()
    .filter((log) => !userId || log.user_id === userId)
    .slice()
    .sort((left, right) => {
      return (
        new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
      )
    })
    .slice(0, limit)
}

export async function recordUsageLog(input: UsageRecordInput) {
  if (isSupabaseConfigured) {
    const log = await createSupabaseUsageLog(input)
    emitUsageChange()
    return log
  }

  const decisionFields = normalizeUsageDecisionFields(input)
  const log: UsageLog = {
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
    metadata: buildUsageMetadata(decisionFields, input.metadata ?? null),
    model_name: input.model_name,
    output_tokens: input.output_tokens,
    scenario_id: input.scenario_id,
    system_prompt_hash: decisionFields.system_prompt_hash,
    total_tokens: input.input_tokens + input.output_tokens,
    user_id: input.user_id,
    user_message_id: input.user_message_id,
  }

  writeStoredUsageLogs([log, ...readStoredUsageLogs()])

  return log
}

export function getUsageSummary(logs: UsageLog[]): UsageLogSummary {
  return logs.reduce<UsageLogSummary>(
    (summary, log) => {
      return {
        totalCreditsConsumed: summary.totalCreditsConsumed + log.credit_cost,
        totalInputTokens: summary.totalInputTokens + log.input_tokens,
        totalOutputTokens: summary.totalOutputTokens + log.output_tokens,
        totalRequests: summary.totalRequests + 1,
        totalTokens: summary.totalTokens + log.total_tokens,
      }
    },
    {
      totalCreditsConsumed: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalRequests: 0,
      totalTokens: 0,
    },
  )
}
