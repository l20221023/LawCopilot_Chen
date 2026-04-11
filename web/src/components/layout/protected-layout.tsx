import { LogOut, MessageSquare, MoreHorizontal, Plus, Settings, Wallet } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../../features/auth/use-auth'
import { useChatRuntime } from '../../features/chat/use-chat-runtime'
import { ChatRuntimeProvider } from '../../features/chat/chat-runtime-provider'

function resolveConversationDisplayTitle(title?: string | null, preview?: string | null) {
  const normalizedTitle = title?.trim() ?? ''

  if (
    normalizedTitle &&
    normalizedTitle !== 'New conversation' &&
    normalizedTitle !== '新建会话' &&
    normalizedTitle !== '新对话'
  ) {
    return normalizedTitle
  }

  if (preview?.trim()) {
    return preview.trim().slice(0, 24)
  }

  return '新建会话'
}

function shouldShowPreview(title?: string | null, preview?: string | null) {
  if (!preview?.trim()) {
    return false
  }

  return resolveConversationDisplayTitle(title, preview) !== preview.trim().slice(0, 24)
}

function ChatAppShell() {
  const { profile, signOut } = useAuth()
  const chat = useChatRuntime()
  const navigate = useNavigate()
  const location = useLocation()
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false)
  const accountMenuRef = useRef<HTMLDivElement | null>(null)

  const routeConversationId = useMemo(() => {
    const match = location.pathname.match(/^\/app\/chat\/([^/]+)$/)
    return match?.[1] ?? null
  }, [location.pathname])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        accountMenuRef.current &&
        !accountMenuRef.current.contains(event.target as Node)
      ) {
        setIsAccountMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  async function handleSelectConversation(conversationId: string) {
    await chat.selectConversation(conversationId)
    navigate(`/app/chat/${conversationId}`)
  }

  async function handleDeleteConversation(conversationId: string) {
    const fallbackConversationId = await chat.deleteConversation(conversationId)

    if (conversationId !== routeConversationId) {
      return
    }

    if (fallbackConversationId) {
      navigate(`/app/chat/${fallbackConversationId}`, { replace: true })
      return
    }

    navigate('/app/chat', { replace: true })
  }

  return (
    <div className="h-[100dvh] overflow-hidden bg-transparent px-3 py-3 md:px-4 md:py-4">
      <div className="mx-auto grid h-full w-full max-w-[1500px] gap-3 md:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="flex h-full min-h-0 flex-col overflow-hidden rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-3">
          <div className="space-y-3 border-b border-[color:var(--border)] pb-3">
            <div className="px-1">
              <div className="text-sm font-semibold text-[color:var(--text)]">
                LawCopilot
              </div>
              <p className="mt-1 text-xs leading-5 muted-copy">法律 AI 对话工作台</p>
            </div>

            <button
              type="button"
              onClick={() => navigate('/app/chat')}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm font-medium text-[color:var(--text)] transition hover:border-[color:var(--border-strong)] hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={chat.isBusy}
            >
              <Plus className="h-4 w-4" />
              新建对话
            </button>
          </div>

          <div className="mt-3 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
            {chat.conversations.length > 0 ? (
              chat.conversations.map((conversation) => {
                const isActive = conversation.id === routeConversationId
                const displayTitle = resolveConversationDisplayTitle(
                  conversation.title,
                  conversation.last_message_preview,
                )

                return (
                  <article
                    key={conversation.id}
                    className={[
                      'group rounded-[18px] border px-3 py-3 transition',
                      isActive
                        ? 'border-[color:var(--border-strong)] bg-white'
                        : 'border-transparent bg-transparent hover:border-[color:var(--border)] hover:bg-white/80',
                    ].join(' ')}
                  >
                    <button
                      type="button"
                      onClick={() => void handleSelectConversation(conversation.id)}
                      className="w-full text-left"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-[color:var(--text)]">
                            {displayTitle}
                          </div>
                          {shouldShowPreview(
                            conversation.title,
                            conversation.last_message_preview,
                          ) ? (
                            <p className="mt-1 max-h-10 overflow-hidden text-xs leading-5 muted-copy">
                              {conversation.last_message_preview}
                            </p>
                          ) : null}
                        </div>
                        <span className="rounded-full bg-[color:var(--surface-muted)] p-2 text-[color:var(--text-soft)]">
                          <MessageSquare className="h-3.5 w-3.5" />
                        </span>
                      </div>
                    </button>

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="text-[11px] muted-copy">
                        {new Date(conversation.updated_at).toLocaleString('zh-CN', {
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          void handleDeleteConversation(conversation.id)
                        }}
                        className="rounded-full px-2.5 py-1.5 text-xs text-[color:var(--text-soft)] transition hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--text)] disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={chat.isBusy}
                      >
                        删除
                      </button>
                    </div>
                  </article>
                )
              })
            ) : (
              <div className="rounded-[18px] border border-dashed border-[color:var(--border-strong)] bg-white/70 p-4 text-sm leading-6 muted-copy">
                还没有历史会话。点击上方“新建对话”后先选择场景，再进入新的会话窗口。
              </div>
            )}
          </div>

          <div className="mt-auto pt-3" ref={accountMenuRef}>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsAccountMenuOpen((current) => !current)}
                className="flex w-full items-center justify-between rounded-[18px] border border-[color:var(--border)] bg-white px-3 py-3 text-left transition hover:border-[color:var(--border-strong)]"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-[color:var(--text)]">
                    {profile?.nickname}
                  </div>
                  <div className="truncate text-xs muted-copy">{profile?.email}</div>
                </div>
                <MoreHorizontal className="h-5 w-5 text-[color:var(--text-soft)]" />
              </button>

              {isAccountMenuOpen ? (
                <div className="absolute bottom-[calc(100%+0.5rem)] left-0 right-0 rounded-[18px] border border-[color:var(--border)] bg-white p-2 shadow-[0_18px_48px_rgba(15,23,42,0.12)]">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAccountMenuOpen(false)
                      navigate('/app/settings')
                    }}
                    className="flex w-full items-center gap-3 rounded-[14px] px-3 py-3 text-left text-sm text-[color:var(--text)] transition hover:bg-[color:var(--surface-muted)]"
                  >
                    <Settings className="h-4 w-4 text-[color:var(--text-soft)]" />
                    设置
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAccountMenuOpen(false)
                      navigate('/app/pricing')
                    }}
                    className="flex w-full items-center gap-3 rounded-[14px] px-3 py-3 text-left text-sm text-[color:var(--text)] transition hover:bg-[color:var(--surface-muted)]"
                  >
                    <Wallet className="h-4 w-4 text-[color:var(--text-soft)]" />
                    升级套餐
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAccountMenuOpen(false)
                      void signOut()
                    }}
                    className="mt-1 flex w-full items-center gap-3 rounded-[14px] px-3 py-3 text-left text-sm text-[color:var(--warning)] transition hover:bg-[rgba(201,124,34,0.08)]"
                  >
                    <LogOut className="h-4 w-4" />
                    退出登录
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </aside>

        <main className="relative min-w-0 h-full overflow-hidden rounded-[24px] border border-[color:var(--border)] bg-[color:var(--background-strong)]">
          <div className="flex h-full min-h-0 flex-col overflow-hidden px-4 py-4 md:px-6 md:py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

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
        <div className="section-card w-full max-w-md p-6 text-center md:p-8">
          <div className="eyebrow mx-auto">会话加载中</div>
          <h1 className="mt-4 page-title">正在检查账户状态</h1>
          <p className="mt-3 text-sm leading-7 muted-copy">
            正在读取 Supabase 会话与用户资料。
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
        <div className="section-card w-full max-w-xl space-y-5 p-6 md:p-8">
          <span className="eyebrow">资料缺失</span>
          <div className="space-y-2">
            <h1 className="page-title">账户资料暂时不可用</h1>
            <p className="text-sm leading-7 muted-copy">
              {profileError ?? '认证会话存在，但用户资料没有成功加载。'}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void refreshProfile()}
              className="inline-flex items-center justify-center rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-medium text-white transition hover:bg-[color:var(--accent-strong)]"
            >
              重新加载资料
            </button>
            <button
              type="button"
              onClick={() => void signOut()}
              className="inline-flex items-center justify-center rounded-full border border-[color:var(--border-strong)] bg-white px-5 py-3 text-sm font-medium text-[color:var(--text)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent-strong)]"
            >
              退出登录
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <ChatRuntimeProvider>
      <ChatAppShell />
    </ChatRuntimeProvider>
  )
}
