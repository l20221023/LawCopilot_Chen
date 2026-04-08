import { FileImage, FileText } from 'lucide-react'

import { formatFileSize } from '../../lib/utils/file'
import type { MessageAttachment } from '../../types/chat'

type MessageAttachmentListProps = {
  attachments: MessageAttachment[]
}

export function MessageAttachmentList({
  attachments,
}: MessageAttachmentListProps) {
  if (attachments.length === 0) {
    return null
  }

  return (
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      {attachments.map((attachment) => {
        const isImage = attachment.type === 'image'

        return (
          <div
            key={attachment.id}
            className="overflow-hidden rounded-[18px] border border-[color:var(--border)] bg-white/80"
          >
            <div className="flex items-start gap-3 p-3">
              <div className="rounded-2xl bg-[color:var(--accent-soft)] p-2 text-[color:var(--accent-strong)]">
                {isImage ? (
                  <FileImage className="h-4 w-4" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0 space-y-1">
                <div className="truncate text-sm font-medium text-[color:var(--text)]">
                  {attachment.name}
                </div>
                <p className="text-xs uppercase tracking-[0.12em] muted-copy">
                  {attachment.type} · {formatFileSize(attachment.size)}
                </p>
              </div>
            </div>

            {isImage && attachment.preview_data_url ? (
              <div className="px-3 pb-3">
                <div className="overflow-hidden rounded-[16px] border border-[color:var(--border)] bg-[color:var(--background)]">
                  <img
                    src={attachment.preview_data_url}
                    alt={attachment.name}
                    className="h-36 w-full object-cover"
                  />
                </div>
              </div>
            ) : null}

            {!isImage && attachment.extracted_text ? (
              <div className="px-3 pb-3">
                <div className="rounded-[16px] border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-xs leading-6 muted-copy">
                  {attachment.extracted_text.slice(0, 120)}
                  {attachment.extracted_text.length > 120 ? '...' : null}
                </div>
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
