import type {
  ChatAttachmentRequestPart,
  MessageAttachment,
  PreparedMessageAttachments,
} from '../../types/chat'

function createAttachmentTextPart(
  attachment: MessageAttachment,
): ChatAttachmentRequestPart | null {
  const extractedText = attachment.extracted_text?.trim()

  if (!extractedText) {
    return null
  }

  return {
    type: 'text',
    attachment_id: attachment.id,
    name: attachment.name,
    mime_type: attachment.mime_type,
    text: `附件：${attachment.name}\n类型：${attachment.mime_type}\n\n${extractedText}`,
  }
}

function createAttachmentImagePart(
  attachment: MessageAttachment,
): ChatAttachmentRequestPart | null {
  if (attachment.type !== 'image' || !attachment.preview_data_url) {
    return null
  }

  return {
    type: 'image_url',
    attachment_id: attachment.id,
    name: attachment.name,
    mime_type: attachment.mime_type,
    image_url: {
      url: attachment.preview_data_url,
    },
  }
}

export function prepareMessageAttachments(
  attachments: MessageAttachment[],
): PreparedMessageAttachments {
  const contentParts = attachments.flatMap((attachment) => {
    const imagePart = createAttachmentImagePart(attachment)
    const textPart = createAttachmentTextPart(attachment)

    return [imagePart, textPart].filter(
      (part): part is ChatAttachmentRequestPart => part !== null,
    )
  })

  const extractedText = attachments
    .map((attachment) => {
      const content = attachment.extracted_text?.trim()

      if (!content) {
        return null
      }

      return `【附件 ${attachment.name}】\n${content}`
    })
    .filter((block): block is string => Boolean(block))
    .join('\n\n')

  return {
    attachments,
    content_parts: contentParts,
    extracted_text: extractedText,
  }
}
