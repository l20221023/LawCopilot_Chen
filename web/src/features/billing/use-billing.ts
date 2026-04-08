import { useMemo } from 'react'

import { buildBillingOverview } from './billing-rules'
import type { UserProfile } from '../../types/auth'

export function useBilling(profile: UserProfile | null) {
  const overview = useMemo(
    () => (profile ? buildBillingOverview(profile) : null),
    [profile],
  )

  return {
    overview,
    profile: overview?.profile ?? profile,
  }
}
