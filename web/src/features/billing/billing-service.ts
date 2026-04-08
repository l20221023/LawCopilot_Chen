import type { UserProfile } from '../../types/auth'

import {
  buildBillingOverview,
  checkQuotaBeforeSend,
  consumeCreditAfterSuccess,
  DEFAULT_FREE_CREDITS,
  resolveSubscriptionExpiry,
} from './billing-rules'
import type {
  MockPurchaseOption,
  MockPurchaseReceipt,
  PricingPlan,
} from './billing-types'

const BILLING_STORAGE_KEY = 'lawcopilot-billing-profile'
const listeners = new Set<() => void>()

export const pricingPlans: PricingPlan[] = [
  {
    benefits: [
      '注册即送 5 次额度',
      '发送前校验剩余额度',
      '发送成功后扣减 1 次',
    ],
    description: '用于首次体验流程，不接真实支付。',
    family: 'free',
    headline: '适合初次试用和流程演示',
    id: 'free',
    kind: 'free',
    options: [
      {
        family: 'free',
        id: 'free-reset',
        label: '恢复 5 次试用额度',
        priceLabel: '¥0',
      },
    ],
    title: '免费',
  },
  {
    benefits: [
      '购买后叠加 remaining_credits',
      '额度耗尽后按免费逻辑拦截',
      '适合低频、按件使用',
    ],
    description: '模拟购买按次包，不接真实支付。',
    family: 'limited',
    headline: '按成功发送次数计费',
    id: 'limited',
    kind: 'credits',
    options: [
      {
        credits: 10,
        family: 'limited',
        id: 'credits-10',
        label: '10 次',
        priceLabel: '¥19',
      },
      {
        credits: 50,
        family: 'limited',
        id: 'credits-50',
        label: '50 次',
        priceLabel: '¥79',
      },
      {
        credits: 200,
        family: 'limited',
        id: 'credits-200',
        label: '200 次',
        priceLabel: '¥199',
      },
    ],
    title: '按次付费',
  },
  {
    benefits: [
      '有效期内不限发送次数',
      '到期自动回退 free',
      '适合高频使用场景',
    ],
    description: '模拟订阅时长，不接真实支付。',
    family: 'unlimited',
    headline: '只判断订阅是否仍在有效期',
    id: 'unlimited',
    kind: 'subscription',
    options: [
      {
        durationDays: 7,
        family: 'unlimited',
        id: 'subscription-7d',
        label: '7 天',
        priceLabel: '¥59',
      },
      {
        durationDays: 30,
        family: 'unlimited',
        id: 'subscription-30d',
        label: '30 天',
        priceLabel: '¥199',
      },
      {
        durationDays: 90,
        family: 'unlimited',
        id: 'subscription-90d',
        label: '90 天',
        priceLabel: '¥499',
      },
    ],
    title: '无限订阅',
  },
]

const pricingOptions = pricingPlans.flatMap((plan) => plan.options)

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === BILLING_STORAGE_KEY) {
      emitBillingChange()
    }
  })
}

function emitBillingChange() {
  listeners.forEach((listener) => listener())
}

function createDefaultProfile(): UserProfile {
  const createdAt = new Date().toISOString()

  return {
    created_at: createdAt,
    default_scenario_id: null,
    email: 'preview@lawcopilot.local',
    id: 'preview-user',
    nickname: 'Preview Counsel',
    remaining_credits: DEFAULT_FREE_CREDITS,
    subscription_expires_at: null,
    subscription_plan: 'free',
  }
}

function readStoredProfile() {
  if (typeof window === 'undefined') {
    return createDefaultProfile()
  }

  const rawValue = window.localStorage.getItem(BILLING_STORAGE_KEY)

  if (!rawValue) {
    const initialProfile = createDefaultProfile()
    window.localStorage.setItem(BILLING_STORAGE_KEY, JSON.stringify(initialProfile))
    return initialProfile
  }

  try {
    return JSON.parse(rawValue) as UserProfile
  } catch {
    const initialProfile = createDefaultProfile()
    window.localStorage.setItem(BILLING_STORAGE_KEY, JSON.stringify(initialProfile))
    return initialProfile
  }
}

function writeStoredProfile(profile: UserProfile) {
  if (typeof window === 'undefined') {
    return profile
  }

  window.localStorage.setItem(BILLING_STORAGE_KEY, JSON.stringify(profile))
  emitBillingChange()

  return profile
}

function findPricingOption(optionId: string) {
  return pricingOptions.find((option) => option.id === optionId) ?? null
}

function addDays(days: number) {
  const nextDate = new Date()
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate.toISOString()
}

function delay(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function buildPurchasedProfile(profile: UserProfile, option: MockPurchaseOption) {
  if (option.family === 'free') {
    return {
      ...profile,
      remaining_credits: DEFAULT_FREE_CREDITS,
      subscription_expires_at: null,
      subscription_plan: 'free' as const,
    }
  }

  if (option.family === 'limited') {
    return {
      ...profile,
      remaining_credits: profile.remaining_credits + (option.credits ?? 0),
      subscription_expires_at: null,
      subscription_plan: 'limited' as const,
    }
  }

  return {
    ...profile,
    subscription_expires_at: addDays(option.durationDays ?? 30),
    subscription_plan: 'unlimited' as const,
  }
}

function buildPurchaseMessage(option: MockPurchaseOption) {
  if (option.family === 'free') {
    return '已恢复免费试用档，剩余次数重置为 5。'
  }

  if (option.family === 'limited') {
    return `已模拟购买按次包，新增 ${option.credits ?? 0} 次额度。`
  }

  return `已模拟开通无限订阅，有效期 ${option.durationDays ?? 30} 天。`
}

export function subscribeBillingProfile(listener: () => void) {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

export function readBillingProfileSnapshot() {
  const { profile } = resolveSubscriptionExpiry(readStoredProfile())
  return profile
}

export function getBillingProfile() {
  const currentProfile = readStoredProfile()
  const { changed, profile } = resolveSubscriptionExpiry(currentProfile)

  if (changed) {
    return writeStoredProfile(profile)
  }

  return profile
}

export function ensureBillingProfileFresh() {
  return getBillingProfile()
}

export function refreshBillingOverview() {
  return buildBillingOverview(getBillingProfile())
}

export function checkQuotaBeforeSendWithProfile() {
  return checkQuotaBeforeSend(getBillingProfile())
}

export function consumeCreditAfterSuccessWithProfile(creditCost = 1) {
  const result = consumeCreditAfterSuccess(getBillingProfile(), new Date(), creditCost)

  return {
    ...result,
    profile: writeStoredProfile(result.profile),
  }
}

export function getBillingOverviewForProfile(profile: UserProfile) {
  return buildBillingOverview(profile)
}

export function checkQuotaBeforeSendForProfile(
  profile: UserProfile,
  creditCost = 1,
) {
  return checkQuotaBeforeSend(profile, new Date(), creditCost)
}

export function consumeCreditAfterSuccessForProfile(
  profile: UserProfile,
  creditCost = 1,
) {
  return consumeCreditAfterSuccess(profile, new Date(), creditCost)
}

export async function applyMockPurchaseToProfile(
  profile: UserProfile,
  optionId: string,
) {
  const option = findPricingOption(optionId)

  if (!option) {
    throw new Error('Mock purchase option not found')
  }

  await delay(450)

  const nextProfile = buildPurchasedProfile(profile, option)

  return {
    message: buildPurchaseMessage(option),
    option,
    profile: nextProfile,
    purchasedAt: new Date().toISOString(),
  } satisfies MockPurchaseReceipt
}

export async function applyMockPurchase(optionId: string) {
  const option = findPricingOption(optionId)

  if (!option) {
    throw new Error('Mock purchase option not found')
  }

  await delay(450)

  const nextProfile = buildPurchasedProfile(getBillingProfile(), option)
  const storedProfile = writeStoredProfile(nextProfile)

  return {
    message: buildPurchaseMessage(option),
    option,
    profile: storedProfile,
    purchasedAt: new Date().toISOString(),
  } satisfies MockPurchaseReceipt
}

export function resetBillingProfile() {
  return writeStoredProfile(createDefaultProfile())
}
