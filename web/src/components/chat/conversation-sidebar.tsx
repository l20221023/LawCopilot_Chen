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
  createLabel = 'New conversation',
  description = 'Continue an existing workspace or start a new one.',
  title = 'Conversations',
}: ConversationSidebarProps) {
  return (
    <aside className="section-card flex min-h-[640px] flex-col p-4 md:p-5">
      <div className="space-y-4 border-b border-[color:var(--border)] pb-4">
        <div className="space-y-2">
          <span className="eyebrow">Chat</span>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-[color:var(--text)]">
              {title}
            </h2>
            <p className="mt-2 text-sm leading-6 muted-copy">{description}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void onCreateConversation()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[color:var(--accent)] px-4 py-3 text-sm font-medium text-white transition hover:bg-[color:var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isBusy}
        >
          <Plus className="h-4 w-4" />
          {createLabel}
        </button>
      </div>

      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3 overflow-auto pr-1">
        {conversations.length > 0 ? (
          conversations.map((conversation) => {
            const isActive = conversation.id === activeConversationId

            return (
              <article
                key={conversation.id}
                className={[
                  'group rounded-[20px] border p-4 text-left transition',
                  isActive
                    ? 'border-[color:var(--accent)] bg-[color:var(--accent-soft)]'
                    : 'border-[color:var(--border)] bg-white/75 hover:border-[color:var(--border-strong)] hover:bg-white',
                ].join(' ')}
              >
                <button
                  type="button"
                  onClick={() => void onSelectConversation(conversation.id)}
                  className="w-full text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-[color:var(--text)]">
                        {conversation.title}
                      </div>
                      <p className="mt-2 max-h-12 overflow-hidden text-sm leading-6 muted-copy">
                        {conversation.last_message_preview ?? 'No messages yet.'}
                      </p>
                    </div>
                    <span className="rounded-full border border-[color:var(--border)] bg-white/80 p-2 text-[color:var(--text-soft)]">
                      <MessageSquareMore className="h-4 w-4" />
                    </span>
                  </div>
                </button>

                <div className="mt-4 flex items-center justify-between gap-2">
                  <span className="mono-label text-[color:var(--text-soft)]">
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
                    className="inline-flex items-center gap-1 rounded-full border border-transparent px-3 py-1.5 text-sm text-[color:var(--text-soft)] transition hover:border-[color:var(--border)] hover:bg-white"
                    disabled={isBusy}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              </article>
            )
          })
        ) : (
          <div className="rounded-[20px] border border-dashed border-[color:var(--border-strong)] bg-white/70 p-5">
            <div className="text-base font-medium text-[color:var(--text)]">
              No conversations yet.
            </div>
            <p className="mt-2 text-sm leading-6 muted-copy">
              Start a new workspace from the button above.
            </p>
          </div>
        )}
      </div>
    </aside>
  )
}
