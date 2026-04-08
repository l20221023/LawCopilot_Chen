import type { SubscriptionPlan, UserProfile } from '../../types/auth'

export type BillingAccessStatus =
  | 'eligible'
  | 'credits-exhausted'
  | 'subscription-expired'

export type BillingTone = 'free' | 'limited' | 'unlimited' | 'expired'

export type QuotaCheckResult = {
  allowed: boolean
  accessStatus: BillingAccessStatus
  creditCost: number
  profile: UserProfile
  reason: string
}

export type CreditConsumptionResult = {
  consumedCredits: number
  profile: UserProfile
}

export type BillingOverview = {
  canSend: boolean
  detailLabel: string
  nextActionLabel: string
  planLabel: string
  profile: UserProfile
  statusLabel: string
  tone: BillingTone
}

export type MockPurchaseKind = 'free' | 'credits' | 'subscription'

export type MockPurchaseOption = {
  credits?: number
  durationDays?: number
  family: SubscriptionPlan
  id: string
  label: string
  priceLabel: string
}

export type PricingPlan = {
  benefits: string[]
  description: string
  family: SubscriptionPlan
  headline: string
  id: string
  kind: MockPurchaseKind
  options: MockPurchaseOption[]
  title: string
}

export type MockPurchaseReceipt = {
  message: string
  option: MockPurchaseOption
  purchasedAt: string
  profile: UserProfile
}
