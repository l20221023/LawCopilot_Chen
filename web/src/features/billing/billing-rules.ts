import type { UserProfile } from '../../types/auth'

import type {
  BillingOverview,
  CreditConsumptionResult,
  QuotaCheckResult,
} from './billing-types'

export const DEFAULT_FREE_CREDITS = 5
export const DEFAULT_CREDIT_COST = 1

function isFutureDate(value: string | null, now: Date) {
  if (!value) {
    return false
  }

  return new Date(value).getTime() > now.getTime()
}

export function resolveSubscriptionExpiry(
  profile: UserProfile,
  now: Date = new Date(),
) {
  if (profile.subscription_plan !== 'unlimited') {
    return {
      changed: false,
      profile,
    }
  }

  if (isFutureDate(profile.subscription_expires_at, now)) {
    return {
      changed: false,
      profile,
    }
  }

  return {
    changed: true,
    profile: {
      ...profile,
      subscription_expires_at: null,
      subscription_plan:
        profile.remaining_credits > 0 ? ('limited' as const) : ('free' as const),
    },
  }
}

export function checkQuotaBeforeSend(
  profile: UserProfile,
  now: Date = new Date(),
  creditCost: number = DEFAULT_CREDIT_COST,
): QuotaCheckResult {
  const { profile: normalizedProfile } = resolveSubscriptionExpiry(profile, now)

  if (normalizedProfile.subscription_plan === 'unlimited') {
    return {
      accessStatus: 'eligible',
      allowed: true,
      creditCost,
      profile: normalizedProfile,
      reason: '当前为无限订阅，有效期内发送不扣减次数。',
    }
  }

  if (normalizedProfile.remaining_credits >= creditCost) {
    return {
      accessStatus: 'eligible',
      allowed: true,
      creditCost,
      profile: normalizedProfile,
      reason: `当前剩余 ${normalizedProfile.remaining_credits} 次，可继续发送。`,
    }
  }

  return {
    accessStatus:
      profile.subscription_plan === 'unlimited'
        ? 'subscription-expired'
        : 'credits-exhausted',
    allowed: false,
    creditCost,
    profile: normalizedProfile,
    reason:
      profile.subscription_plan === 'unlimited'
        ? '订阅已过期，已自动回退为免费或按次状态，请续费或购买次数包。'
        : '当前剩余次数不足，请购买次数包或升级无限订阅。',
  }
}

export function consumeCreditAfterSuccess(
  profile: UserProfile,
  now: Date = new Date(),
  creditCost: number = DEFAULT_CREDIT_COST,
): CreditConsumptionResult {
  const { profile: normalizedProfile } = resolveSubscriptionExpiry(profile, now)

  if (normalizedProfile.subscription_plan === 'unlimited') {
    return {
      consumedCredits: 0,
      profile: normalizedProfile,
    }
  }

  return {
    consumedCredits: Math.min(normalizedProfile.remaining_credits, creditCost),
    profile: {
      ...normalizedProfile,
      remaining_credits: Math.max(
        0,
        normalizedProfile.remaining_credits - creditCost,
      ),
    },
  }
}

export function buildBillingOverview(
  profile: UserProfile,
  now: Date = new Date(),
): BillingOverview {
  const quotaCheck = checkQuotaBeforeSend(profile, now)
  const normalizedProfile = quotaCheck.profile

  if (normalizedProfile.subscription_plan === 'unlimited') {
    return {
      canSend: true,
      detailLabel: normalizedProfile.subscription_expires_at
        ? `到期时间：${normalizedProfile.subscription_expires_at}`
        : '到期时间待补充',
      nextActionLabel: '发送成功后仅记录 usage，不扣减次数。',
      planLabel: '无限订阅',
      profile: normalizedProfile,
      statusLabel: '有效期内不限发送次数',
      tone: 'unlimited',
    }
  }

  if (!quotaCheck.allowed) {
    return {
      canSend: false,
      detailLabel: `剩余次数：${normalizedProfile.remaining_credits}`,
      nextActionLabel:
        quotaCheck.accessStatus === 'subscription-expired'
          ? '订阅已过期，当前按免费或按次规则拦截。'
          : '当前发送会被前置额度校验拦截。',
      planLabel:
        normalizedProfile.subscription_plan === 'limited' ? '按次付费' : '免费',
      profile: normalizedProfile,
      statusLabel:
        quotaCheck.accessStatus === 'subscription-expired'
          ? '订阅过期，已回退到次数模式'
          : '次数已用尽',
      tone:
        quotaCheck.accessStatus === 'subscription-expired'
          ? 'expired'
          : normalizedProfile.subscription_plan,
    }
  }

  return {
    canSend: true,
    detailLabel: `剩余次数：${normalizedProfile.remaining_credits}`,
    nextActionLabel: '发送成功后扣减 1 次。',
    planLabel:
      normalizedProfile.subscription_plan === 'limited' ? '按次付费' : '免费',
    profile: normalizedProfile,
    statusLabel:
      normalizedProfile.subscription_plan === 'limited'
        ? '按次额度可用'
        : '免费试用中',
    tone: normalizedProfile.subscription_plan,
  }
}
