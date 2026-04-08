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

    const chargeResult = consumeCreditAfterSuccessForProfile(
      quotaCheck.profile,
      1,
    )
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
      <div className="space-y-6">
        <header className="space-y-3">
          <span className="eyebrow">Settings</span>
          <h1 className="page-title">Account settings</h1>
        </header>
        <SectionCard
          title="Profile unavailable"
          description="Settings need the authenticated profile payload."
        >
          <div className="rounded-[18px] border border-[color:var(--border-strong)] bg-white/80 p-4 text-sm leading-6 muted-copy">
            Sign in and ensure the public.users row is available before testing
            billing and usage flows.
          </div>
        </SectionCard>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <span className="eyebrow">Settings</span>
        <h1 className="page-title">额度、订阅与 usage</h1>
        <p className="max-w-3xl text-sm leading-7 muted-copy md:text-base">
          这里保留始终可见的额度入口、发送前校验结果、发送成功后扣减演示，以及 usage
          记录查看入口。
        </p>
      </header>

      <BillingStatusCard overview={overview} title="账户额度入口" />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
        <SectionCard
          title="账户信息"
          description="当前使用 billing service 管理前端 profile，后续由 Session 6 接认证态真实数据。"
        >
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-[18px] bg-white/80 p-4 text-sm leading-6 text-[color:var(--text)]">
              <div className="mono-label text-[color:var(--accent)]">账户</div>
              <div className="mt-2">{profile.nickname}</div>
              <div className="muted-copy">{profile.email}</div>
            </div>
            <div className="rounded-[18px] bg-white/80 p-4 text-sm leading-6 text-[color:var(--text)]">
              <div className="mono-label text-[color:var(--accent)]">订阅状态</div>
              <div className="mt-2">plan: {profile.subscription_plan}</div>
              <div className="muted-copy">
                expires: {formatDateTime(profile.subscription_expires_at)}
              </div>
            </div>
            <div className="rounded-[18px] bg-white/80 p-4 text-sm leading-6 text-[color:var(--text)]">
              <div className="mono-label text-[color:var(--accent)]">额度</div>
              <div className="mt-2">{profile.remaining_credits} 次</div>
              <div className="muted-copy">成功发送后才扣减</div>
            </div>
            <div className="rounded-[18px] bg-white/80 p-4 text-sm leading-6 text-[color:var(--text)]">
              <div className="mono-label text-[color:var(--accent)]">默认场景</div>
              <div className="mt-2">{profile.default_scenario_id ?? '未设置'}</div>
              <div className="muted-copy">Session 6 接真实用户偏好</div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="发送成功后扣减演示"
          description="这里不实现聊天流，只验证前置额度校验、usage 记录和成功后扣减顺序。"
        >
          <div className="space-y-4">
            <div className="rounded-[18px] border border-[color:var(--border-strong)] bg-white/80 p-4 text-sm leading-6 muted-copy">
              调用顺序：`checkQuotaBeforeSend` → `recordUsageLog` → `consumeCreditAfterSuccess`
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
        <SectionCard
          title="最近 usage 记录"
          description="usage_logs 已建立类型与本地 service 骨架，后续可直接替换为数据库实现。"
        >
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
                    scenario: {log.scenario_id} / input: {log.input_tokens} / output:{' '}
                    {log.output_tokens} / total: {log.total_tokens}
                  </div>
                  <div className="muted-copy">credit_cost: {log.credit_cost}</div>
                </div>
              ))
            ) : (
              <div className="rounded-[18px] border border-dashed border-[color:var(--border-strong)] bg-white/70 p-5 text-sm leading-6 muted-copy">
                还没有 usage 记录。点击上方“模拟一次发送成功”后会写入本地日志。
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="usage 汇总"
          description="便于后续成本统计和产品观察。"
        >
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
              <div className="mono-label text-[color:var(--accent)]">总 tokens</div>
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
