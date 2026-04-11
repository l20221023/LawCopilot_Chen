import {
  LoaderCircle,
  Paperclip,
  PauseCircle,
  SendHorizontal,
  X,
} from 'lucide-react'
import type { ChangeEvent } from 'react'
import { useId, useRef } from 'react'

import type { ComposerAttachment } from '../../features/chat/chat-attachment-service'
import { chatAttachmentAccept } from '../../features/chat/chat-attachment-service'
import type { ChatStreamState } from '../../types/chat'
import { ChatAttachmentList } from './chat-attachment-list'

type ChatComposerProps = {
  attachments: ComposerAttachment[]
  attachmentErrorMessage: string | null
  isAttaching: boolean
  isBusy: boolean
  streamError: string | null
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
  isAttaching,
  isBusy,
  streamError,
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
    <section className="border-t border-transparent bg-[color:var(--background-strong)]/96 pt-3 backdrop-blur">
      <div className="mx-auto w-full max-w-3xl">
        <div className="rounded-[24px] border border-[color:var(--border)] bg-white p-3 shadow-[0_12px_40px_rgba(15,23,42,0.08)]">
          <ChatAttachmentList attachments={attachments} onRemove={onRemoveAttachment} />

          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            rows={4}
            placeholder="请输入法律咨询问题，或上传合同、图片、TXT、PDF 后再发送。"
            className="min-h-[108px] w-full resize-none border-0 bg-transparent px-2 py-2 text-[15px] leading-7 text-[color:var(--text)] outline-none placeholder:text-[color:var(--text-soft)]"
          />

          {(attachmentErrorMessage || streamError) && (
            <div className="rounded-[16px] bg-[rgba(201,124,34,0.08)] px-4 py-3 text-sm leading-6 text-[color:var(--warning)]">
              {attachmentErrorMessage ?? streamError}
            </div>
          )}

          <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--border)] pt-3">
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
                className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm text-[color:var(--text)] transition hover:bg-[color:var(--surface-muted)]"
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
                className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm text-[color:var(--text-soft)] transition hover:bg-[color:var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isBusy || attachments.length === 0}
              >
                <X className="h-4 w-4" />
                清空附件
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void onStop()}
                className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-white px-4 py-2.5 text-sm font-medium text-[color:var(--text)] transition hover:border-[color:var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!isBusy}
              >
                <PauseCircle className="h-4 w-4" />
                停止
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
        </div>
      </div>
    </section>
  )
}
