import { FileText, LayoutDashboard, Settings, Wallet } from 'lucide-react'
import { NavLink, Navigate, Outlet } from 'react-router-dom'

import { useAuth } from '../../features/auth/use-auth'

const navigationItems = [
  {
    to: '/app/chat',
    label: '对话',
    description: '主工作台',
    icon: LayoutDashboard,
  },
  {
    to: '/app/pricing',
    label: '定价',
    description: '方案展示',
    icon: Wallet,
  },
  {
    to: '/app/settings',
    label: '设置',
    description: '账户与偏好',
    icon: Settings,
  },
]

export function ProtectedLayout() {
  const {
    isAuthenticated,
    initializing,
    profile,
    profileError,
    refreshProfile,
    signOut,
  } = useAuth()

  if (initializing) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-6">
        <div className="app-shell-card w-full max-w-xl p-6 md:p-8">
          <span className="eyebrow">Loading</span>
          <h1 className="mt-4 page-title">Loading account</h1>
          <p className="mt-3 text-sm leading-7 muted-copy">
            The workspace is waiting for the authenticated session and profile
            data.
          </p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate replace to="/auth" />
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-6">
        <div className="app-shell-card w-full max-w-2xl space-y-5 p-6 md:p-8">
          <span className="eyebrow">Profile required</span>
          <div className="space-y-2">
            <h1 className="page-title">Account profile is unavailable</h1>
            <p className="text-sm leading-7 muted-copy">
              {profileError ??
                'The authenticated session exists, but the user profile could not be loaded.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void refreshProfile()}
              className="inline-flex items-center justify-center rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-medium text-white transition hover:bg-[color:var(--accent-strong)]"
            >
              Retry profile load
            </button>
            <button
              type="button"
              onClick={() => void signOut()}
              className="inline-flex items-center justify-center rounded-full border border-[color:var(--border-strong)] bg-white px-5 py-3 text-sm font-medium text-[color:var(--text)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent-strong)]"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 py-4 md:px-6 md:py-6">
      <div className="app-shell-card mx-auto grid min-h-[calc(100vh-2rem)] w-full max-w-[1480px] gap-6 overflow-hidden p-4 md:grid-cols-[280px_minmax(0,1fr)] md:p-6">
        <aside className="top-6 flex h-fit flex-col gap-6 rounded-[24px] bg-[color:var(--surface-muted)] p-4 md:sticky md:max-h-[calc(100vh-5rem)] md:p-5">
          <div className="space-y-6">
            <div className="space-y-4">
              <span className="eyebrow">
                <FileText className="h-3.5 w-3.5" />
                Session 0
              </span>
              <div className="space-y-2">
                <h1 className="page-title">LawCopilot</h1>
                <p className="text-sm leading-6 muted-copy">
                  当前是项目底座预览。认证、场景、额度与对话逻辑将在后续
                  session 接入。
                </p>
              </div>
            </div>

            <nav className="space-y-2">
              {navigationItems.map(({ to, label, description, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    [
                      'flex items-start gap-3 rounded-2xl border px-4 py-3 transition',
                      isActive
                        ? 'border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-[color:var(--accent-strong)]'
                        : 'border-transparent bg-white/60 text-[color:var(--text)] hover:border-[color:var(--border-strong)] hover:bg-white',
                    ].join(' ')
                  }
                >
                  <Icon className="mt-0.5 h-5 w-5 shrink-0" />
                  <div className="space-y-1">
                    <div className="font-medium">{label}</div>
                    <p className="text-sm leading-5 muted-copy">{description}</p>
                  </div>
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="section-card mt-auto space-y-4 p-4">
            <div className="space-y-1">
              <div className="mono-label uppercase tracking-[0.18em] text-[color:var(--warning)]">
                Account
              </div>
              <p className="text-sm leading-6 muted-copy">
                {profile.nickname}
                <br />
                {profile.email}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void signOut()}
              className="inline-flex w-full items-center justify-center rounded-full bg-[color:var(--text)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[color:var(--accent-strong)]"
            >
              Sign out
            </button>
          </div>
        </aside>

        <main className="flex min-w-0 flex-col gap-6 overflow-auto rounded-[24px] bg-[color:var(--background-strong)] p-4 md:max-h-[calc(100vh-5rem)] md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
