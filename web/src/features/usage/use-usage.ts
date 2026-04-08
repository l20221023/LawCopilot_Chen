import { useSyncExternalStore } from 'react'

import {
  getUsageSummary,
  readUsageLogsSnapshot,
  subscribeUsageLogs,
} from './usage-service'

export function useUsage(userId?: string | null) {
  const logs = useSyncExternalStore(
    subscribeUsageLogs,
    () => readUsageLogsSnapshot(userId),
    () => readUsageLogsSnapshot(userId),
  )

  return {
    logs,
    summary: getUsageSummary(userId),
  }
}
