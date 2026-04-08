import { Copy, RefreshCw, Sparkles } from 'lucide-react'

import type { ChatMessage, ChatStreamState, Conversation } from '../../types/chat'
import { MessageAttachmentList } from './message-attachment-list'

type MessageStreamProps = {
  activeConversation: Conversation | null
  copiedMessageId: string | null
  isLoading: boolean
  messages: ChatMessage[]
  stream: ChatStreamState
  onCopy(content: string, messageId: string): Promise<void>
  onRegenerate(messageId: string): Promise<void>
}

const streamLabels: Record<ChatStreamState['phase'], string> = {
  idle: '就绪',
  submitting: '提交消息',
  'preparing-assistant': '创建回复草稿',
  streaming: '流式占位中',
  stopping: '停止中',
  error: '异常',
}

function AssistantActions({
  content,
  copiedMessageId,
  disabled,
  messageId,
  onCopy,
  onRegenerate,
}: {
  content: string
  copiedMessageId: string | null
  disabled: boolean
  messageId: string
  onCopy(content: string, messageId: string): Promise<void>
  onRegenerate(messageId: string): Promise<void>
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => void onCopy(content, messageId)}
        className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-white px-3 py-1.5 text-sm text-[color:var(--text-soft)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)]"
      >
        <Copy className="h-4 w-4" />
        {copiedMessageId === messageId ? '已复制' : '复制'}
      </button>
      <button
        type="button"
        onClick={() => void onRegenerate(messageId)}
        className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-white px-3 py-1.5 text-sm text-[color:var(--text-soft)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled}
      >
        <RefreshCw className="h-4 w-4" />
        重新生成
      </button>
    </div>
  )
}

export function MessageStream({
  activeConversation,
  copiedMessageId,
  isLoading,
  messages,
  stream,
  onCopy,
  onRegenerate,
}: MessageStreamProps) {
  return (
    <section className="section-card flex min-h-[640px] min-w-0 flex-col p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[color:var(--border)] pb-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="eyebrow">Workspace</span>
            <span className="rounded-full border border-[color:var(--border)] bg-white/80 px-3 py-1 text-xs text-[color:var(--text-soft)]">
              场景接口预留
            </span>
          </div>
          <div>
            <h1 className="page-title">
              {activeConversation?.title ?? '聊天主链路'}
            </h1>
            <p className="mt-2 text-sm leading-6 muted-copy">
              页面层只装配会话列表、消息流和输入区；真实 AI、额度、场景配置在后续 session 接入。
            </p>
          </div>
        </div>

        <div className="rounded-[20px] border border-[color:var(--border)] bg-white/85 px-4 py-3">
          <div className="mono-label text-[color:var(--accent)]">Stream state</div>
          <div className="mt-2 text-sm font-medium text-[color:var(--text)]">
            {streamLabels[stream.phase]}
          </div>
          <p className="mt-1 text-xs leading-5 muted-copy">
            assistantId: {stream.assistantMessageId ?? '待创建'}
          </p>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-auto py-5">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm muted-copy">正在加载聊天数据...</p>
          </div>
        ) : messages.length > 0 ? (
          <div className="space-y-4">
            {messages.map((message) => {
              const isAssistant = message.role === 'assistant'
              const isStreaming = message.status === 'streaming'

              return (
                <article
                  key={message.id}
                  className={[
                    'max-w-4xl rounded-[24px] border p-4 md:p-5',
                    message.role === 'user'
                      ? 'ml-auto border-[color:var(--accent)] bg-[color:var(--accent-soft)]'
                      : 'border-[color:var(--border)] bg-white/85',
                  ].join(' ')}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="inline-flex items-center gap-2 text-sm font-medium text-[color:var(--text)]">
                      {isAssistant ? (
                        <Sparkles className="h-4 w-4 text-[color:var(--accent)]" />
                      ) : null}
                      {message.role === 'user' ? '用户' : '助手'}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-[color:var(--border)] px-3 py-1 text-xs text-[color:var(--text-soft)]">
                        {message.status ?? 'complete'}
                      </span>
                      <span className="mono-label text-[color:var(--text-soft)]">
                        {new Date(message.updated_at ?? message.created_at).toLocaleTimeString(
                          'zh-CN',
                          {
                            hour: '2-digit',
                            minute: '2-digit',
                          },
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[color:var(--text)]">
                    {message.content || (isStreaming ? '正在接收内容...' : '等待内容写入')}
                  </div>

                  <MessageAttachmentList attachments={message.attachments} />

                  {message.error_message ? (
                    <p className="mt-3 text-sm text-[color:var(--warning)]">
                      {message.error_message}
                    </p>
                  ) : null}

                  {isAssistant ? (
                    <AssistantActions
                      content={message.content}
                      copiedMessageId={copiedMessageId}
                      disabled={stream.phase !== 'idle'}
                      messageId={message.id}
                      onCopy={onCopy}
                      onRegenerate={onRegenerate}
                    />
                  ) : null}
                </article>
              )
            })}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center rounded-[24px] border border-dashed border-[color:var(--border-strong)] bg-white/60 px-6 py-10 text-center">
            <div className="rounded-full bg-[color:var(--accent-soft)] p-3 text-[color:var(--accent)]">
              <Sparkles className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-xl font-semibold text-[color:var(--text)]">
              从第一条消息开始
            </h2>
            <p className="mt-2 max-w-md text-sm leading-6 muted-copy">
              这里已经预留了消息列表和 assistant 操作区，后续可直接接入真实流式输出。
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
