import { useEffect, useMemo, useState } from 'react'

import {
  getUsageSummary,
  listUsageLogs,
  subscribeUsageLogs,
} from './usage-service'
import type { UsageLog } from '../../types/usage'

export function useUsage(userId?: string | null) {
  const [logs, setLogs] = useState<UsageLog[]>([])

  useEffect(() => {
    let active = true

    async function loadLogs() {
      const nextLogs = await listUsageLogs(10, userId)

      if (active) {
        setLogs(nextLogs)
      }
    }

    void loadLogs()

    const unsubscribe = subscribeUsageLogs(() => {
      void loadLogs()
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [userId])

  const summary = useMemo(() => getUsageSummary(logs), [logs])

  return {
    logs,
    summary,
  }
}
