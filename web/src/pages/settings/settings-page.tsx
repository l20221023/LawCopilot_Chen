import { useState } from 'react'

import { SectionCard } from '../../components/common/section-card'
import { useAuth } from '../../features/auth/use-auth'
import { BillingStatusCard } from '../../features/billing/components/billing-status-card'
import {
  checkQuotaBeforeSendForProfile,
  consumeCreditAfterSuccessForProfile,
} from '../../features/billing/billing-service'
import { useBilling } from '../../features/billing/use-billing'
import { recordUsageLog } from '../../features/usage/usage-service'
import { useUsage } from '../../features/usage/use-usage'

function formatDateTime(value: string | null) {
  if (!value) {
    return '未设置'
  }

  return new Intl.DateTimeFormat('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

export function SettingsPage() {
  const { profile, updateProfile } = useAuth()
  const { overview } = useBilling(profile)
  const { logs, summary } = useUsage(profile?.id ?? null)
  const [sendState, setSendState] = useState<{
    isSubmitting: boolean
    message: string | null
    tone: 'error' | 'success' | null
  }>({
    isSubmitting: false,
    message: null,
    tone: null,
  })

  async function handleSimulateSuccessfulSend() {
    if (!profile) {
      return
    }

    const quotaCheck = checkQuotaBeforeSendForProfile(profile)

    if (!quotaCheck.allowed) {
      setSendState({
        isSubmitting: false,
        message: quotaCheck.reason,
        tone: 'error',
      })
      return
    }

    setSendState({
      isSubmitting: true,
      message: '正在模拟发送成功后的 usage 记录与扣减...',
      tone: null,
    })

    await recordUsageLog({
      assistant_message_id: crypto.randomUUID(),
      conversation_id: 'preview-conversation',
      credit_cost: quotaCheck.profile.subscription_plan === 'unlimited' ? 0 : 1,
      input_tokens: 640,
      model_name: 'openrouter/mock-preview',
      output_tokens: 312,
      scenario_id: profile.default_scenario_id ?? 'contract-review',
      user_id: profile.id,
      user_message_id: crypto.randomUUID(),
    })

    const chargeResult = consumeCreditAfterSuccessForProfile(quotaCheck.profile, 1)
    await updateProfile({
      remaining_credits: chargeResult.profile.remaining_credits,
      subscription_expires_at: chargeResult.profile.subscription_expires_at,
      subscription_plan: chargeResult.profile.subscription_plan,
    })

    setSendState({
      isSubmitting: false,
      message:
        chargeResult.consumedCredits > 0
          ? `usage 已记录，发送成功后扣减 ${chargeResult.consumedCredits} 次。`
          : 'usage 已记录，当前为无限订阅，本次未扣减次数。',
      tone: 'success',
    })
  }

  if (!profile || !overview) {
    return (
      <SectionCard title="资料不可用" description="设置页需要当前登录用户资料。">
        <div className="rounded-[18px] border border-[color:var(--border-strong)] bg-white/80 p-4 text-sm leading-6 muted-copy">
          请先完成登录，并确保 public.users 可以正常读取。
        </div>
      </SectionCard>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="space-y-3">
        <span className="eyebrow">设置</span>
        <h1 className="page-title">账户、额度与使用记录</h1>
        <p className="max-w-3xl text-sm leading-7 muted-copy md:text-base">
          这里展示当前账户资料、套餐状态，以及最近的 usage 记录。
        </p>
      </header>

      <BillingStatusCard overview={overview} title="当前额度状态" />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
        <SectionCard title="账户信息" description="当前账户绑定的基础资料。">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-[18px] bg-white/80 p-4 text-sm leading-6 text-[color:var(--text)]">
              <div className="mono-label text-[color:var(--accent)]">账户</div>
              <div className="mt-2">{profile.nickname}</div>
              <div className="muted-copy">{profile.email}</div>
            </div>
            <div className="rounded-[18px] bg-white/80 p-4 text-sm leading-6 text-[color:var(--text)]">
              <div className="mono-label text-[color:var(--accent)]">订阅状态</div>
              <div className="mt-2">方案：{profile.subscription_plan}</div>
              <div className="muted-copy">
                到期：{formatDateTime(profile.subscription_expires_at)}
              </div>
            </div>
            <div className="rounded-[18px] bg-white/80 p-4 text-sm leading-6 text-[color:var(--text)]">
              <div className="mono-label text-[color:var(--accent)]">剩余次数</div>
              <div className="mt-2">{profile.remaining_credits} 次</div>
              <div className="muted-copy">发送成功后才扣减</div>
            </div>
            <div className="rounded-[18px] bg-white/80 p-4 text-sm leading-6 text-[color:var(--text)]">
              <div className="mono-label text-[color:var(--accent)]">默认场景</div>
              <div className="mt-2">{profile.default_scenario_id ?? '未设置'}</div>
              <div className="muted-copy">用于初始化聊天入口页的默认选择</div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="发送成功后的扣减演示"
          description="这里不走真实对话流，只验证扣费和 usage 顺序。"
        >
          <div className="space-y-4">
            <div className="rounded-[18px] border border-[color:var(--border-strong)] bg-white/80 p-4 text-sm leading-6 muted-copy">
              调用顺序：额度校验 → usage 记录 → 成功后扣减
            </div>
            <button
              type="button"
              onClick={handleSimulateSuccessfulSend}
              disabled={sendState.isSubmitting}
              className="inline-flex w-full items-center justify-center rounded-full bg-[color:var(--text)] px-5 py-3 text-sm font-medium text-white transition hover:bg-[color:var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sendState.isSubmitting ? '模拟中...' : '模拟一次发送成功'}
            </button>
            {sendState.message ? (
              <p
                className={[
                  'text-sm leading-6',
                  sendState.tone === 'error'
                    ? 'text-[color:var(--warning)]'
                    : 'text-[color:var(--accent-strong)]',
                ].join(' ')}
              >
                {sendState.message}
              </p>
            ) : null}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
        <SectionCard title="最近 usage 记录" description="最近的 token 与次数消耗情况。">
          <div className="space-y-3">
            {logs.length > 0 ? (
              logs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-[18px] border border-[color:var(--border-strong)] bg-white/80 p-4 text-sm leading-6 text-[color:var(--text)]"
                >
                  <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                    <div>{log.model_name}</div>
                    <div className="muted-copy">{formatDateTime(log.created_at)}</div>
                  </div>
                  <div className="mt-2 muted-copy">
                    场景：{log.scenario_id} / 输入：{log.input_tokens} / 输出：
                    {log.output_tokens} / 总计：{log.total_tokens}
                  </div>
                  <div className="muted-copy">扣减次数：{log.credit_cost}</div>
                </div>
              ))
            ) : (
              <div className="rounded-[18px] border border-dashed border-[color:var(--border-strong)] bg-white/70 p-5 text-sm leading-6 muted-copy">
                还没有 usage 记录。点击上方的模拟按钮后，这里会出现新的记录。
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard title="usage 汇总" description="用于查看当前整体使用情况。">
          <div className="grid gap-3">
            <div className="rounded-[18px] bg-white/80 p-4 text-sm leading-6 text-[color:var(--text)]">
              <div className="mono-label text-[color:var(--accent)]">请求数</div>
              <div className="mt-2">{summary.totalRequests}</div>
            </div>
            <div className="rounded-[18px] bg-white/80 p-4 text-sm leading-6 text-[color:var(--text)]">
              <div className="mono-label text-[color:var(--accent)]">输入 / 输出</div>
              <div className="mt-2">
                {summary.totalInputTokens} / {summary.totalOutputTokens}
              </div>
            </div>
            <div className="rounded-[18px] bg-white/80 p-4 text-sm leading-6 text-[color:var(--text)]">
              <div className="mono-label text-[color:var(--accent)]">总 Tokens</div>
              <div className="mt-2">{summary.totalTokens}</div>
            </div>
            <div className="rounded-[18px] bg-white/80 p-4 text-sm leading-6 text-[color:var(--text)]">
              <div className="mono-label text-[color:var(--accent)]">累计扣减</div>
              <div className="mt-2">{summary.totalCreditsConsumed}</div>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
