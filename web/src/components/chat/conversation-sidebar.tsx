import { MessageSquareMore, Plus, Trash2 } from 'lucide-react'

import type { Conversation } from '../../types/chat'

type ConversationSidebarProps = {
  activeConversationId: string | null
  conversations: Conversation[]
  isBusy: boolean
  onCreateConversation(): Promise<void | string | null>
  onDeleteConversation(conversationId: string): Promise<void | string | null>
  onSelectConversation(conversationId: string): Promise<void>
  createLabel?: string
  description?: string
  title?: string
}

export function ConversationSidebar({
  activeConversationId,
  conversations,
  isBusy,
  onCreateConversation,
  onDeleteConversation,
  onSelectConversation,
  createLabel = '新建对话',
  description = '历史会话',
  title = '会话',
}: ConversationSidebarProps) {
  return (
    <aside className="flex min-h-[640px] flex-col rounded-[20px] border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-3">
      <div className="space-y-3 border-b border-[color:var(--border)] pb-3">
        <div>
          <div className="text-sm font-semibold text-[color:var(--text)]">{title}</div>
          <p className="mt-1 text-xs leading-5 muted-copy">{description}</p>
        </div>

        <button
          type="button"
          onClick={() => void onCreateConversation()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm font-medium text-[color:var(--text)] transition hover:border-[color:var(--border-strong)] hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isBusy}
        >
          <Plus className="h-4 w-4" />
          {createLabel}
        </button>
      </div>

      <div className="mt-3 flex min-h-0 flex-1 flex-col gap-2 overflow-auto pr-1">
        {conversations.length > 0 ? (
          conversations.map((conversation) => {
            const isActive = conversation.id === activeConversationId

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
                  onClick={() => void onSelectConversation(conversation.id)}
                  className="w-full text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-[color:var(--text)]">
                        {conversation.title}
                      </div>
                      <p className="mt-1 max-h-10 overflow-hidden text-xs leading-5 muted-copy">
                        {conversation.last_message_preview ?? '暂无消息'}
                      </p>
                    </div>
                    <span className="rounded-full bg-[color:var(--surface-muted)] p-2 text-[color:var(--text-soft)]">
                      <MessageSquareMore className="h-3.5 w-3.5" />
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
                      void onDeleteConversation(conversation.id)
                    }}
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs text-[color:var(--text-soft)] transition hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--text)]"
                    disabled={isBusy}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    删除
                  </button>
                </div>
              </article>
            )
          })
        ) : (
          <div className="rounded-[18px] border border-dashed border-[color:var(--border-strong)] bg-white/70 p-4 text-sm leading-6 muted-copy">
            还没有历史会话。
          </div>
        )}
      </div>
    </aside>
  )
}
