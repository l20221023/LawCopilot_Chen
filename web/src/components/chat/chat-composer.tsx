import { LoaderCircle, Paperclip, PauseCircle, SendHorizontal, Sparkles, X } from 'lucide-react'
import type { ChangeEvent } from 'react'
import { useId, useRef } from 'react'

import type { ComposerAttachment } from '../../features/chat/chat-attachment-service'
import { chatAttachmentAccept } from '../../features/chat/chat-attachment-service'
import type { SubmittedComposerState } from '../../features/chat/use-chat-composer'
import type { PreparedMessageAttachments } from '../../types/chat'
import type { ChatStreamState } from '../../types/chat'
import { ChatAttachmentList } from './chat-attachment-list'

type ChatComposerProps = {
  attachments: ComposerAttachment[]
  attachmentErrorMessage: string | null
  attachmentRequestPreview: PreparedMessageAttachments
  isAttaching: boolean
  isBusy: boolean
  lastSubmittedRequest: SubmittedComposerState | null
  streamPhase: ChatStreamState['phase']
  value: string
  onAddAttachments(files: File[]): Promise<void>
  onChange(value: string): void
  onClearAttachments(): void
  onRemoveAttachment(attachmentId: string): void
  onSend(): Promise<void>
  onStop(): Promise<void>
}

export function ChatComposer({
  attachments,
  attachmentErrorMessage,
  attachmentRequestPreview,
  isAttaching,
  isBusy,
  lastSubmittedRequest,
  streamPhase,
  value,
  onAddAttachments,
  onChange,
  onClearAttachments,
  onRemoveAttachment,
  onSend,
  onStop,
}: ChatComposerProps) {
  const inputId = useId()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const sendDisabled = (!value.trim() && attachments.length === 0) || isBusy
  const isProcessing =
    streamPhase === 'submitting' ||
    streamPhase === 'preparing-assistant' ||
    streamPhase === 'streaming' ||
    streamPhase === 'stopping'

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])

    if (files.length > 0) {
      await onAddAttachments(files)
    }

    event.target.value = ''
  }

  return (
    <section className="section-card p-4 md:p-5">
      <div className="space-y-4 rounded-[22px] border border-[color:var(--border)] bg-white/85 p-3">
        <div className="flex flex-wrap items-center gap-2 text-xs leading-5 muted-copy">
          <span className="rounded-full border border-[color:var(--border)] bg-white/80 px-3 py-1">
            支持 `image/*`
          </span>
          <span className="rounded-full border border-[color:var(--border)] bg-white/80 px-3 py-1">
            支持 `application/pdf`
          </span>
          <span className="rounded-full border border-[color:var(--border)] bg-white/80 px-3 py-1">
            支持 `text/plain`
          </span>
        </div>

        <ChatAttachmentList
          attachments={attachments}
          onRemove={onRemoveAttachment}
        />

        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={4}
          placeholder="输入法律咨询问题、案件事实或合同审阅需求，也可以只上传附件。"
          className="min-h-[112px] w-full resize-none border-0 bg-transparent text-sm leading-7 text-[color:var(--text)] outline-none placeholder:text-[color:var(--text-soft)]"
        />

        <div className="rounded-[18px] border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-3 text-xs leading-6">
          <p className="m-0 text-[color:var(--text)]">
            当前已装配 {attachmentRequestPreview.attachments.length} 个附件，生成{' '}
            {attachmentRequestPreview.content_parts.length} 个请求层 content parts。
          </p>
          <p className="m-0 muted-copy">
            {lastSubmittedRequest
              ? `最近一次发送草稿：${lastSubmittedRequest.request_attachments.attachments.length} 个附件。`
              : '发送时会把 attachments 与 request preview 一起交给后续聊天请求层。'}
          </p>
          {attachmentErrorMessage ? (
            <p className="m-0 text-[color:var(--warning)]">{attachmentErrorMessage}</p>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--border)] pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              id={inputId}
              ref={fileInputRef}
              type="file"
              accept={chatAttachmentAccept}
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-white px-4 py-2.5 text-sm font-medium text-[color:var(--text)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent-strong)]"
              disabled={isBusy}
            >
              {isAttaching ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Paperclip className="h-4 w-4" />
              )}
              添加附件
            </button>
            <label htmlFor={inputId} className="sr-only">
              上传聊天附件
            </label>
            <button
              type="button"
              onClick={onClearAttachments}
              className="inline-flex items-center gap-2 rounded-full border border-transparent px-4 py-2.5 text-sm font-medium text-[color:var(--text-soft)] transition hover:border-[color:var(--border)] hover:bg-white"
              disabled={isBusy || attachments.length === 0}
            >
              <X className="h-4 w-4" />
              清空附件
            </button>
          </div>

          <p className="text-sm muted-copy">
            已预留停止与流式状态挂点，附件将写入 `messages.attachments`。
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void onStop()}
              className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-white px-4 py-2.5 text-sm font-medium text-[color:var(--text)] transition hover:border-[color:var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!isBusy}
            >
              <PauseCircle className="h-4 w-4" />
              停止占位
            </button>
            <button
              type="button"
              onClick={() => void onSend()}
              className="inline-flex items-center gap-2 rounded-full bg-[color:var(--text)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[color:var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={sendDisabled}
            >
              <SendHorizontal className="h-4 w-4" />
              {isProcessing ? '处理中' : '发送'}
            </button>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-[18px] border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-3 text-xs leading-6">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--warning)]" />
          <div className="space-y-1">
            <p className="m-0 text-[color:var(--text)]">
              TXT 会直接读取文本；PDF 提供前端适配口，当前先保留占位，不接第三方解析器。
            </p>
            <p className="m-0 muted-copy">
              Session 6 可在发送前把 `attachmentRequestPreview.content_parts` 并入真实 AI 请求。
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
