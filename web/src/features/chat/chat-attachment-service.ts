import {
  getFileExtension,
  readFileAsDataUrl,
  readFileAsText,
} from '../../lib/utils/file'
import type { AttachmentType, MessageAttachment } from '../../types/chat'

export const chatAttachmentAccept = 'image/*,.pdf,text/plain,.txt'

type AttachmentTextExtractionStatus = 'ready' | 'skipped' | 'error'

type AttachmentTextExtractionResult = {
  text: string | null
  status: AttachmentTextExtractionStatus
  provider: 'browser-txt' | 'pdf-placeholder' | 'none'
  error_message?: string
}

export type ComposerAttachment = {
  file: File
  attachment: MessageAttachment
  extraction: AttachmentTextExtractionResult
}

export type ComposerAttachmentResult = {
  attachments: ComposerAttachment[]
  rejected_files: Array<{
    file_name: string
    reason: string
  }>
}

const fallbackMimeTypeByType: Record<AttachmentType, string> = {
  image: 'image/*',
  pdf: 'application/pdf',
  txt: 'text/plain',
}

function resolveAttachmentType(file: File): AttachmentType | null {
  if (file.type.startsWith('image/')) {
    return 'image'
  }

  if (file.type === 'application/pdf') {
    return 'pdf'
  }

  if (file.type === 'text/plain') {
    return 'txt'
  }

  const extension = getFileExtension(file.name)

  if (extension === 'pdf') {
    return 'pdf'
  }

  if (extension === 'txt') {
    return 'txt'
  }

  return null
}

function createBaseAttachment(
  file: File,
  type: AttachmentType,
): MessageAttachment {
  return {
    id: crypto.randomUUID(),
    type,
    name: file.name,
    size: file.size,
    mime_type: file.type || fallbackMimeTypeByType[type],
    storage_path: null,
    extracted_text: null,
    preview_data_url: null,
  }
}

async function extractTxtText(file: File): Promise<AttachmentTextExtractionResult> {
  try {
    const text = (await readFileAsText(file)).trim()

    return {
      text,
      status: 'ready',
      provider: 'browser-txt',
    }
  } catch (error) {
    return {
      text: null,
      status: 'error',
      provider: 'browser-txt',
      error_message:
        error instanceof Error ? error.message : 'Failed to read TXT attachment.',
    }
  }
}

async function extractPdfText(): Promise<AttachmentTextExtractionResult> {
  return {
    text: null,
    status: 'skipped',
    provider: 'pdf-placeholder',
    error_message:
      'PDF text extraction adapter is reserved but not wired to a parser yet.',
  }
}

async function buildAttachmentFromFile(
  file: File,
): Promise<ComposerAttachment | null> {
  const type = resolveAttachmentType(file)

  if (!type) {
    return null
  }

  const attachment = createBaseAttachment(file, type)

  if (type === 'image') {
    attachment.preview_data_url = await readFileAsDataUrl(file)

    return {
      file,
      attachment,
      extraction: {
        text: null,
        status: 'skipped',
        provider: 'none',
      },
    }
  }

  const extraction =
    type === 'txt' ? await extractTxtText(file) : await extractPdfText()

  attachment.extracted_text = extraction.text

  return {
    file,
    attachment,
    extraction,
  }
}

export async function createComposerAttachments(
  files: Iterable<File>,
): Promise<ComposerAttachmentResult> {
  const attachments: ComposerAttachment[] = []
  const rejectedFiles: ComposerAttachmentResult['rejected_files'] = []

  for (const file of files) {
    if (file.size <= 0) {
      rejectedFiles.push({
        file_name: file.name,
        reason: '文件内容为空，无法作为聊天附件使用。',
      })
      continue
    }

    try {
      const attachment = await buildAttachmentFromFile(file)

      if (!attachment) {
        rejectedFiles.push({
          file_name: file.name,
          reason: '仅支持图片、PDF 和 TXT 文件。',
        })
        continue
      }

      attachments.push(attachment)
    } catch (error) {
      rejectedFiles.push({
        file_name: file.name,
        reason:
          error instanceof Error ? error.message : '附件处理失败，请稍后重试。',
      })
    }
  }

  return {
    attachments,
    rejected_files: rejectedFiles,
  }
}
