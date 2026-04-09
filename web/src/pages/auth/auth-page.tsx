import { LockKeyhole, Mail, ShieldCheck, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'

import { SectionCard } from '../../components/common/section-card'
import { useAuth } from '../../features/auth/use-auth'
import { isSupabaseConfigured } from '../../lib/supabase/client'
import { getErrorMessage } from '../../lib/supabase/errors'

type AuthMode = 'sign-in' | 'sign-up'

const authHighlights = [
  'Supabase email and password authentication',
  'Persistent browser session and route protection',
  'User profile loading from public.users',
]

function getFriendlyAuthError(error: unknown) {
  const message = getErrorMessage(error)

  if (message.includes('Invalid login credentials')) {
    return '邮箱或密码不正确。'
  }

  if (message.includes('User already registered')) {
    return '该邮箱已注册，请直接登录。'
  }

  if (message.includes('Email rate limit exceeded')) {
    return '认证请求过于频繁，请稍后再试。'
  }

  if (message.includes('For security purposes')) {
    return '为了安全，短时间内无法重复发送邮件，请稍后再试。'
  }

  return message
}

export function AuthPage() {
  const { isAuthenticated, loading, requestPasswordReset, signIn, signUp } =
    useAuth()
  const [mode, setMode] = useState<AuthMode>('sign-in')
  const [nickname, setNickname] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [resetEmail, setResetEmail] = useState('')
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  if (isAuthenticated) {
    return <Navigate replace to="/app/chat" />
  }

  const submitLabel =
    mode === 'sign-in'
      ? submitting || loading
        ? '正在登录...'
        : '邮箱登录'
      : submitting || loading
        ? '正在注册...'
        : '创建账户'

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)

    const normalizedEmail = email.trim()
    const normalizedNickname = nickname.trim()

    if (!normalizedEmail || !password) {
      setErrorMessage('请填写邮箱和密码。')
      return
    }

    if (mode === 'sign-up' && !normalizedNickname) {
      setErrorMessage('注册时请填写昵称。')
      return
    }

    setSubmitting(true)

    try {
      if (mode === 'sign-in') {
        await signIn({
          email: normalizedEmail,
          password,
        })
        return
      }

      const result = await signUp({
        nickname: normalizedNickname,
        email: normalizedEmail,
        password,
      })

      setPassword('')
      setSuccessMessage(
        result.needsEmailConfirmation
          ? '注册成功。请检查邮箱并完成验证后再登录。'
          : '注册成功，已为你创建登录会话。',
      )
    } catch (error) {
      setErrorMessage(getFriendlyAuthError(error))
    } finally {
      setSubmitting(false)
    }
  }

  async function handlePasswordResetRequest(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)

    const normalizedEmail = resetEmail.trim()

    if (!normalizedEmail) {
      setErrorMessage('请输入用于接收重置邮件的邮箱。')
      return
    }

    setSubmitting(true)

    try {
      const redirectTo =
        typeof window === 'undefined'
          ? undefined
          : `${window.location.origin}/auth/reset-password`

      await requestPasswordReset(normalizedEmail, redirectTo)
      setSuccessMessage(
        '重置密码邮件已发送。请点击邮件中的链接进入专用的重置密码页面。',
      )
      setShowForgotPassword(false)
    } catch (error) {
      setErrorMessage(getFriendlyAuthError(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1320px] items-center px-4 py-8 md:px-6">
      <div className="grid w-full gap-6 lg:grid-cols-[minmax(0,1.12fr)_440px]">
        <section className="app-shell-card relative overflow-hidden p-6 md:p-8">
          <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-r from-[color:var(--accent-soft)] via-transparent to-[rgba(181,106,27,0.14)]" />
          <div className="relative space-y-8">
            <span className="eyebrow">
              <ShieldCheck className="h-3.5 w-3.5" />
              Authentication
            </span>

            <div className="max-w-3xl space-y-5">
              <h1 className="display-title">LawCopilot</h1>
              <p className="max-w-2xl text-base leading-8 muted-copy md:text-lg">
                使用邮箱密码进入工作台。认证由 Supabase Auth 处理，业务资料从
                public.users 读取。
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {authHighlights.map((item) => (
                <SectionCard
                  key={item}
                  title={item}
                  description="The current auth layer is ready for sign-in, sign-up, and password recovery testing."
                >
                  <div className="mono-label text-[color:var(--accent)]">
                    Ready
                  </div>
                </SectionCard>
              ))}
            </div>
          </div>
        </section>

        <section className="app-shell-card flex flex-col gap-6 p-6 md:p-8">
          <div className="flex gap-2 rounded-full bg-[color:var(--surface-muted)] p-1">
            <button
              type="button"
              onClick={() => setMode('sign-in')}
              className={[
                'flex-1 rounded-full px-4 py-2 text-sm font-medium transition',
                mode === 'sign-in'
                  ? 'bg-[color:var(--accent)] text-white'
                  : 'text-[color:var(--text-soft)] hover:bg-white/70',
              ].join(' ')}
            >
              登录
            </button>
            <button
              type="button"
              onClick={() => setMode('sign-up')}
              className={[
                'flex-1 rounded-full px-4 py-2 text-sm font-medium transition',
                mode === 'sign-up'
                  ? 'bg-[color:var(--accent)] text-white'
                  : 'text-[color:var(--text-soft)] hover:bg-white/70',
              ].join(' ')}
            >
              注册
            </button>
          </div>

          <div className="space-y-2">
            <h2 className="page-title">
              {mode === 'sign-in' ? '邮箱密码登录' : '创建新账户'}
            </h2>
            <p className="text-sm leading-7 muted-copy">
              {mode === 'sign-in'
                ? '使用 Supabase Auth 登录并恢复浏览器中的持久会话。'
                : '注册后会自动尝试读取 public.users 中的扩展资料。'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm">
            <button
              type="button"
              onClick={() => {
                setShowForgotPassword((current) => !current)
                setErrorMessage(null)
                setSuccessMessage(null)
                setResetEmail(email.trim())
              }}
              className="font-medium text-[color:var(--accent)] transition hover:text-[color:var(--accent-strong)]"
            >
              {showForgotPassword ? '收起重置入口' : '忘记密码？'}
            </button>
            <Link
              to="/auth/reset-password"
              className="font-medium text-[color:var(--text-soft)] transition hover:text-[color:var(--text)]"
            >
              我已经拿到恢复链接
            </Link>
          </div>

          {!isSupabaseConfigured ? (
            <div className="rounded-[18px] border border-[color:var(--warning)]/35 bg-[rgba(181,106,27,0.12)] p-4 text-sm leading-7 text-[color:var(--text)]">
              当前未配置 `VITE_SUPABASE_URL` 或 `VITE_SUPABASE_ANON_KEY`，认证表单已禁用。
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

          {showForgotPassword ? (
            <form
              className="space-y-4 rounded-[22px] border border-[color:var(--border)] bg-white/70 p-4"
              onSubmit={handlePasswordResetRequest}
            >
              <div className="space-y-2">
                <h3 className="text-base font-semibold text-[color:var(--text)]">
                  发送重置密码邮件
                </h3>
                <p className="text-sm leading-6 muted-copy">
                  邮件中的链接会跳转到 `/auth/reset-password`，不再直接进入工作台。
                </p>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-[color:var(--text)]">
                  恢复邮箱
                </span>
                <div className="flex items-center gap-3 rounded-[18px] border border-[color:var(--border)] bg-white/80 px-4 py-3">
                  <Mail className="h-4 w-4 text-[color:var(--text-soft)]" />
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(event) => setResetEmail(event.target.value)}
                    placeholder="lawyer@example.com"
                    autoComplete="email"
                    disabled={submitting || loading || !isSupabaseConfigured}
                    className="w-full border-0 bg-transparent p-0 text-sm outline-none"
                  />
                </div>
              </label>

              <button
                type="submit"
                disabled={submitting || loading || !isSupabaseConfigured}
                className="inline-flex w-full items-center justify-center rounded-full bg-[color:var(--text)] px-5 py-3 text-sm font-medium text-white transition enabled:hover:bg-[color:var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? '正在发送...' : '发送恢复邮件'}
              </button>
            </form>
          ) : null}

          <form className="space-y-4" onSubmit={handleSubmit}>
            {mode === 'sign-up' ? (
              <label className="block space-y-2">
                <span className="text-sm font-medium text-[color:var(--text)]">
                  昵称
                </span>
                <div className="flex items-center gap-3 rounded-[18px] border border-[color:var(--border)] bg-white/80 px-4 py-3">
                  <UserRound className="h-4 w-4 text-[color:var(--text-soft)]" />
                  <input
                    value={nickname}
                    onChange={(event) => setNickname(event.target.value)}
                    placeholder="例如：张律师"
                    disabled={submitting || loading || !isSupabaseConfigured}
                    className="w-full border-0 bg-transparent p-0 text-sm outline-none"
                  />
                </div>
              </label>
            ) : null}

            <label className="block space-y-2">
              <span className="text-sm font-medium text-[color:var(--text)]">
                邮箱
              </span>
              <div className="flex items-center gap-3 rounded-[18px] border border-[color:var(--border)] bg-white/80 px-4 py-3">
                <Mail className="h-4 w-4 text-[color:var(--text-soft)]" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="lawyer@example.com"
                  autoComplete="email"
                  disabled={submitting || loading || !isSupabaseConfigured}
                  className="w-full border-0 bg-transparent p-0 text-sm outline-none"
                />
              </div>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-[color:var(--text)]">
                密码
              </span>
              <div className="flex items-center gap-3 rounded-[18px] border border-[color:var(--border)] bg-white/80 px-4 py-3">
                <LockKeyhole className="h-4 w-4 text-[color:var(--text-soft)]" />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="请输入至少 6 位密码"
                  autoComplete={
                    mode === 'sign-in' ? 'current-password' : 'new-password'
                  }
                  disabled={submitting || loading || !isSupabaseConfigured}
                  className="w-full border-0 bg-transparent p-0 text-sm outline-none"
                />
              </div>
            </label>

            <button
              type="submit"
              disabled={submitting || loading || !isSupabaseConfigured}
              className="inline-flex w-full items-center justify-center rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-medium text-white transition enabled:hover:bg-[color:var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitLabel}
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}
