import { LockKeyhole, ShieldCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { SectionCard } from '../../components/common/section-card'
import { useAuth } from '../../features/auth/use-auth'
import { isSupabaseConfigured } from '../../lib/supabase/client'
import { getErrorMessage } from '../../lib/supabase/errors'

function getFriendlyResetError(error: unknown) {
  const message = getErrorMessage(error)

  if (message.includes('Auth session missing')) {
    return '当前没有有效的恢复会话。请重新点击邮件中的重置密码链接。'
  }

  if (message.includes('New password should be different')) {
    return '新密码不能与旧密码相同。'
  }

  if (message.includes('Password should be at least')) {
    return '密码长度不足，请使用更长的密码。'
  }

  return message
}

function hasRecoveryHint() {
  if (typeof window === 'undefined') {
    return false
  }

  const hintSource = `${window.location.hash}${window.location.search}`.toLowerCase()
  return hintSource.includes('type=recovery') || hintSource.includes('access_token')
}

export function PasswordResetPage() {
  const { authUser, isAuthenticated, loading, signOut, updatePassword } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const hasRecoveryLinkHint = useMemo(() => hasRecoveryHint(), [])
  const canSubmit = isSupabaseConfigured && isAuthenticated && !loading && !submitting

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)

    if (!password || !confirmPassword) {
      setErrorMessage('请输入并确认新密码。')
      return
    }

    if (password !== confirmPassword) {
      setErrorMessage('两次输入的密码不一致。')
      return
    }

    setSubmitting(true)

    try {
      await updatePassword(password)
      setPassword('')
      setConfirmPassword('')
      setSuccessMessage('密码已更新。你现在可以继续进入工作台，或先退出后重新登录验证。')
    } catch (error) {
      setErrorMessage(getFriendlyResetError(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1180px] items-center px-4 py-8 md:px-6">
      <div className="grid w-full gap-6 lg:grid-cols-[minmax(0,1.08fr)_440px]">
        <section className="app-shell-card relative overflow-hidden p-6 md:p-8">
          <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-r from-[color:var(--accent-soft)] via-transparent to-[rgba(181,106,27,0.14)]" />
          <div className="relative space-y-8">
            <span className="eyebrow">
              <ShieldCheck className="h-3.5 w-3.5" />
              Password recovery
            </span>

            <div className="max-w-3xl space-y-5">
              <h1 className="display-title">Reset account password</h1>
              <p className="max-w-2xl text-base leading-8 muted-copy md:text-lg">
                This page is dedicated to the recovery link flow. It prevents the
                app from redirecting directly into the chat workspace before the
                user has a chance to set a new password.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <SectionCard
                title="Step 1"
                description="Open the password recovery email sent by Supabase."
              >
                <div className="mono-label text-[color:var(--accent)]">Email link</div>
              </SectionCard>
              <SectionCard
                title="Step 2"
                description="Arrive on this route with a valid recovery session."
              >
                <div className="mono-label text-[color:var(--accent)]">
                  Recovery session
                </div>
              </SectionCard>
              <SectionCard
                title="Step 3"
                description="Set a new password and continue the test flow."
              >
                <div className="mono-label text-[color:var(--accent)]">Update user</div>
              </SectionCard>
            </div>
          </div>
        </section>

        <section className="app-shell-card flex flex-col gap-6 p-6 md:p-8">
          <div className="space-y-2">
            <h2 className="page-title">Create a new password</h2>
            <p className="text-sm leading-7 muted-copy">
              {hasRecoveryLinkHint
                ? 'The current URL looks like a recovery link. If the session is valid, you can set the new password below.'
                : 'If you opened this page manually, first request a recovery email from the sign-in page.'}
            </p>
          </div>

          {!isSupabaseConfigured ? (
            <div className="rounded-[18px] border border-[color:var(--warning)]/35 bg-[rgba(181,106,27,0.12)] p-4 text-sm leading-7 text-[color:var(--text)]">
              当前未配置 `VITE_SUPABASE_URL` 或 `VITE_SUPABASE_ANON_KEY`，无法进行密码恢复测试。
            </div>
          ) : null}

          {!loading && !isAuthenticated ? (
            <div className="rounded-[18px] border border-[color:var(--warning)]/35 bg-[rgba(181,106,27,0.12)] p-4 text-sm leading-7 text-[color:var(--text)]">
              当前没有检测到恢复会话。请重新打开邮件中的密码重置链接。
            </div>
          ) : null}

          {authUser?.email ? (
            <div className="rounded-[18px] border border-[color:var(--border)] bg-white/80 p-4 text-sm leading-7 text-[color:var(--text)]">
              当前恢复账号：{authUser.email}
            </div>
          ) : null}

          {errorMessage ? (
            <div className="rounded-[18px] border border-red-200 bg-red-50 p-4 text-sm leading-7 text-red-700">
              {errorMessage}
            </div>
          ) : null}

          {successMessage ? (
            <div className="rounded-[18px] border border-emerald-200 bg-emerald-50 p-4 text-sm leading-7 text-emerald-700">
              {successMessage}
            </div>
          ) : null}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-[color:var(--text)]">
                新密码
              </span>
              <div className="flex items-center gap-3 rounded-[18px] border border-[color:var(--border)] bg-white/80 px-4 py-3">
                <LockKeyhole className="h-4 w-4 text-[color:var(--text-soft)]" />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="请输入新的登录密码"
                  autoComplete="new-password"
                  disabled={!canSubmit}
                  className="w-full border-0 bg-transparent p-0 text-sm outline-none"
                />
              </div>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-[color:var(--text)]">
                确认新密码
              </span>
              <div className="flex items-center gap-3 rounded-[18px] border border-[color:var(--border)] bg-white/80 px-4 py-3">
                <LockKeyhole className="h-4 w-4 text-[color:var(--text-soft)]" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="请再次输入新密码"
                  autoComplete="new-password"
                  disabled={!canSubmit}
                  className="w-full border-0 bg-transparent p-0 text-sm outline-none"
                />
              </div>
            </label>

            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex w-full items-center justify-center rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-medium text-white transition enabled:hover:bg-[color:var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? '正在更新密码...' : '更新密码'}
            </button>
          </form>

          <div className="flex flex-wrap gap-3">
            <Link
              to="/auth"
              className="inline-flex items-center justify-center rounded-full border border-[color:var(--border-strong)] bg-white px-5 py-3 text-sm font-medium text-[color:var(--text)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent-strong)]"
            >
              返回登录页
            </Link>
            {isAuthenticated ? (
              <button
                type="button"
                onClick={() => void signOut()}
                className="inline-flex items-center justify-center rounded-full border border-[color:var(--border-strong)] bg-white px-5 py-3 text-sm font-medium text-[color:var(--text)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent-strong)]"
              >
                退出当前会话
              </button>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  )
}
