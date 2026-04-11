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
      <SectionCard
        title="资料不可用"
        description="升级套餐前，需要先拿到当前登录用户的资料。"
      >
        <div className="rounded-[18px] border border-[color:var(--border-strong)] bg-white/80 p-4 text-sm leading-6 muted-copy">
          请先完成登录，并确保 public.users 可以正常读取。
        </div>
      </SectionCard>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="space-y-3">
        <span className="eyebrow">升级套餐</span>
        <h1 className="page-title">选择适合你的使用方案</h1>
        <p className="max-w-3xl text-sm leading-7 muted-copy md:text-base">
          当前页面是套餐体验页。购买流程仍然是前端模拟，但状态更新、额度规则和对话发送链路已经打通。
        </p>
      </header>

      <BillingStatusCard overview={overview} title="当前额度" />

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
          title="购买说明"
          description="这里模拟的是套餐状态切换，不接真实支付。"
        >
          <ul className="space-y-3 text-sm leading-6 muted-copy">
            <li>免费档默认提供 5 次可用额度。</li>
            <li>按次付费会直接增加剩余次数。</li>
            <li>无限订阅在有效期内不会扣减次数。</li>
            <li>订阅过期后，会自动回退到免费或按次模式。</li>
          </ul>
        </SectionCard>

        <SectionCard
          title="最近一次模拟购买"
          description="这里显示套餐 service 返回的 receipt。"
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
              <div className="muted-copy">还没有触发模拟购买。</div>
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
