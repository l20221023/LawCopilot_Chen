import { Copy, RefreshCw, Sparkles } from 'lucide-react'

import type { ChatMessage, ChatStreamState } from '../../types/chat'
import { MessageAttachmentList } from './message-attachment-list'

type MessageStreamProps = {
  copiedMessageId: string | null
  isLoading: boolean
  messages: ChatMessage[]
  stream: ChatStreamState
  onCopy(content: string, messageId: string): Promise<void>
  onRegenerate(messageId: string): Promise<void>
}

function getStatusLabel(status: ChatMessage['status'], role: ChatMessage['role']) {
  if (role === 'user') {
    return '已发送'
  }

  switch (status) {
    case 'pending':
      return '等待生成'
    case 'streaming':
      return '正在生成'
    case 'stopped':
      return '已停止'
    case 'error':
      return '异常'
    default:
      return '已完成'
  }
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
  copiedMessageId,
  isLoading,
  messages,
  stream,
  onCopy,
  onRegenerate,
}: MessageStreamProps) {
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[20px] bg-transparent">
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pb-4">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm muted-copy">正在加载对话内容...</p>
          </div>
        ) : messages.length > 0 ? (
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
            {messages.map((message) => {
              const isAssistant = message.role === 'assistant'
              const isStreaming = message.status === 'streaming'

              return (
                <article
                  key={message.id}
                  className={[
                    'rounded-[22px] px-5 py-4',
                    message.role === 'user'
                      ? 'ml-auto max-w-[88%] border border-[color:var(--border)] bg-white'
                      : 'max-w-full bg-transparent',
                  ].join(' ')}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="inline-flex items-center gap-2 text-sm font-medium text-[color:var(--text)]">
                      {isAssistant ? (
                        <Sparkles className="h-4 w-4 text-[color:var(--accent)]" />
                      ) : null}
                      {message.role === 'user' ? '你' : '法律助手'}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-[color:var(--surface-muted)] px-2.5 py-1 text-[11px] text-[color:var(--text-soft)]">
                        {getStatusLabel(message.status, message.role)}
                      </span>
                      <span className="text-[11px] muted-copy">
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

                  <div className="mt-3 whitespace-pre-wrap text-[15px] leading-8 text-[color:var(--text)]">
                    {message.content || (isStreaming ? '正在生成内容...' : '等待内容写入')}
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
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <div className="rounded-full bg-[color:var(--accent-soft)] p-4 text-[color:var(--accent)]">
              <Sparkles className="h-6 w-6" />
            </div>
            <h2 className="mt-5 text-2xl font-semibold text-[color:var(--text)]">
              先发送第一条消息
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-7 muted-copy">
              你可以直接提问，或者上传合同、图片、TXT、PDF 作为上下文。
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
