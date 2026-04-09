import type {
  UsageLog,
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

function readStoredUsageLogs() {
  if (typeof window === 'undefined') {
    return [] as UsageLog[]
  }

  const rawValue = window.localStorage.getItem(USAGE_STORAGE_KEY)

  if (!rawValue) {
    return []
  }

  try {
    return JSON.parse(rawValue) as UsageLog[]
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

  const log: UsageLog = {
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
