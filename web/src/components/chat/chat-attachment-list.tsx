import { FileImage, FileText, Trash2 } from 'lucide-react'

import type { ComposerAttachment } from '../../features/chat/chat-attachment-service'
import { formatFileSize } from '../../lib/utils/file'

type ChatAttachmentListProps = {
  attachments: ComposerAttachment[]
  onRemove: (attachmentId: string) => void
}

function getAttachmentBadge(attachment: ComposerAttachment) {
  if (attachment.attachment.type === 'image') {
    return '图片缩略图已生成'
  }

  if (attachment.attachment.type === 'txt') {
    return attachment.attachment.extracted_text
      ? 'TXT 文本已读取'
      : 'TXT 内容为空'
  }

  return 'PDF 文本解析接口待接入'
}

export function ChatAttachmentList({
  attachments,
  onRemove,
}: ChatAttachmentListProps) {
  if (attachments.length === 0) {
    return null
  }

  return (
    <div className="mb-3 grid gap-3 md:grid-cols-2">
      {attachments.map((item) => {
        const isImage = item.attachment.type === 'image'
        const previewText =
          item.attachment.type === 'txt'
            ? item.attachment.extracted_text?.slice(0, 120)
            : item.extraction.error_message

        return (
          <article
            key={item.attachment.id}
            className="section-card overflow-hidden border-[color:var(--border)]"
          >
            <div className="flex items-start justify-between gap-3 p-4">
              <div className="flex min-w-0 items-start gap-3">
                <div className="mt-0.5 rounded-2xl bg-[color:var(--accent-soft)] p-2 text-[color:var(--accent-strong)]">
                  {isImage ? (
                    <FileImage className="h-5 w-5" />
                  ) : (
                    <FileText className="h-5 w-5" />
                  )}
                </div>
                <div className="min-w-0 space-y-1">
                  <h3 className="truncate text-sm font-semibold text-[color:var(--text)]">
                    {item.attachment.name}
                  </h3>
                  <p className="text-xs uppercase tracking-[0.12em] muted-copy">
                    {item.attachment.type} · {formatFileSize(item.attachment.size)}
                  </p>
                  <p className="text-xs leading-5 text-[color:var(--accent-strong)]">
                    {getAttachmentBadge(item)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onRemove(item.attachment.id)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[color:var(--border)] bg-white text-[color:var(--text-soft)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)]"
                aria-label={`移除附件 ${item.attachment.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            {isImage && item.attachment.preview_data_url ? (
              <div className="px-4 pb-4">
                <div className="overflow-hidden rounded-[18px] border border-[color:var(--border)] bg-[color:var(--background)]">
                  <img
                    src={item.attachment.preview_data_url}
                    alt={item.attachment.name}
                    className="h-44 w-full object-cover"
                  />
                </div>
              </div>
            ) : null}

            {!isImage && previewText ? (
              <div className="px-4 pb-4">
                <div className="rounded-[18px] border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-xs leading-6 muted-copy">
                  {previewText}
                  {item.attachment.type === 'txt' &&
                  item.attachment.extracted_text &&
                  item.attachment.extracted_text.length > 120
                    ? '...'
                    : null}
                </div>
              </div>
            ) : null}
          </article>
        )
      })}
    </div>
  )
}
