import { useState } from 'react'

import { SectionCard } from '../../components/common/section-card'
import { useAuth } from '../../features/auth/use-auth'
import { BillingStatusCard } from '../../features/billing/components/billing-status-card'
import { PricingPlanCard } from '../../features/billing/components/pricing-plan-card'
import {
  applyMockPurchaseToProfile,
  pricingPlans,
} from '../../features/billing/billing-service'
import type { MockPurchaseReceipt } from '../../features/billing/billing-types'
import { useBilling } from '../../features/billing/use-billing'

const defaultSelectedOptions = pricingPlans.reduce<Record<string, string>>(
  (selection, plan) => {
    selection[plan.id] = plan.options[0]?.id ?? ''
    return selection
  },
  {},
)

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

export function PricingPage() {
  const { profile, updateProfile } = useAuth()
  const { overview } = useBilling(profile)
  const [selectedOptions, setSelectedOptions] = useState(defaultSelectedOptions)
  const [purchaseError, setPurchaseError] = useState<string | null>(null)
  const [purchaseState, setPurchaseState] = useState<{
    activePlanId: string | null
    receipt: MockPurchaseReceipt | null
  }>({
    activePlanId: null,
    receipt: null,
  })

  async function handlePurchase(planId: string) {
    if (!profile) {
      return
    }

    const optionId = selectedOptions[planId]

    if (!optionId) {
      return
    }

    setPurchaseError(null)
    setPurchaseState((current) => ({
      ...current,
      activePlanId: planId,
    }))

    try {
      const receipt = await applyMockPurchaseToProfile(profile, optionId)
      await updateProfile({
        remaining_credits: receipt.profile.remaining_credits,
        subscription_expires_at: receipt.profile.subscription_expires_at,
        subscription_plan: receipt.profile.subscription_plan,
      })
      setPurchaseState({
        activePlanId: null,
        receipt,
      })
    } catch (error) {
      setPurchaseState((current) => ({
        ...current,
        activePlanId: null,
      }))
      setPurchaseError(
        error instanceof Error ? error.message : '模拟购买失败，请稍后重试。',
      )
    }
  }

  if (!profile || !overview) {
    return (
      <div className="space-y-6">
        <header className="space-y-3">
          <span className="eyebrow">Pricing</span>
          <h1 className="page-title">Pricing and billing</h1>
        </header>
        <SectionCard
          title="Profile unavailable"
          description="Pricing actions need an authenticated user profile."
        >
          <div className="rounded-[18px] border border-[color:var(--border-strong)] bg-white/80 p-4 text-sm leading-6 muted-copy">
            Sign in successfully and make sure the public.users row can be read
            before testing purchase flows.
          </div>
        </SectionCard>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <span className="eyebrow">Pricing</span>
        <h1 className="page-title">定价与额度方案</h1>
        <p className="max-w-3xl text-sm leading-7 muted-copy md:text-base">
          当前提供免费、按次付费、无限订阅三类方案。购买流程仅为前端模拟，服务层已按
          Session 6 可接入的接口形态拆分。
        </p>
      </header>

      <BillingStatusCard overview={overview} title="当前额度入口" />

      <div className="grid gap-4 xl:grid-cols-3">
        {pricingPlans.map((plan) => (
          <PricingPlanCard
            key={plan.id}
            currentPlanLabel={overview.planLabel}
            isBusy={purchaseState.activePlanId === plan.id}
            isCurrentFamily={overview.profile.subscription_plan === plan.family}
            onPurchase={() => handlePurchase(plan.id)}
            onSelectOption={(optionId) => {
              setSelectedOptions((current) => ({
                ...current,
                [plan.id]: optionId,
              }))
            }}
            plan={plan}
            selectedOptionId={selectedOptions[plan.id]}
          />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)]">
        <SectionCard
          title="购买流程说明"
          description="模拟购买只更新前端 profile 状态，不接真实支付。"
        >
          <ul className="space-y-3 text-sm leading-6 muted-copy">
            <li>• 免费档初始化 5 次额度，发送成功后扣减 1 次。</li>
            <li>• 按次包购买后累加 remaining_credits，耗尽后会被发送前校验拦截。</li>
            <li>• 无限订阅只判断到期时间，到期后自动回退 free。</li>
          </ul>
        </SectionCard>

        <SectionCard
          title="最近一次模拟购买"
          description="这里展示 service 返回的 receipt，便于后续接 Session 6 联调。"
        >
          <div className="rounded-[18px] border border-[color:var(--border-strong)] bg-white/80 p-4 text-sm leading-6 text-[color:var(--text)]">
            {purchaseState.receipt ? (
              <div className="space-y-2">
                <div>{purchaseState.receipt.message}</div>
                <div className="muted-copy">
                  选项：{purchaseState.receipt.option.label} /{' '}
                  {purchaseState.receipt.option.priceLabel}
                </div>
                <div className="muted-copy">
                  时间：{formatDateTime(purchaseState.receipt.purchasedAt)}
                </div>
              </div>
            ) : (
              <div className="muted-copy">尚未触发模拟购买。</div>
            )}
          </div>
          {purchaseError ? (
            <p className="text-sm leading-6 text-[color:var(--warning)]">
              {purchaseError}
            </p>
          ) : null}
        </SectionCard>
      </div>
    </div>
  )
}
