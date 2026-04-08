import { useState } from 'react'

import { prepareMessageAttachments } from '../../lib/ai/prepare-chat-attachments'
import type { MessageAttachment, PreparedMessageAttachments } from '../../types/chat'
import {
  createComposerAttachments,
  type ComposerAttachment,
} from './chat-attachment-service'

export type SubmittedComposerState = {
  message: string
  request_attachments: PreparedMessageAttachments
}

export function useChatComposer() {
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([])
  const [isAttaching, setIsAttaching] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [submittedState, setSubmittedState] =
    useState<SubmittedComposerState | null>(null)

  const messageAttachments = attachments.map(
    (item): MessageAttachment => item.attachment,
  )
  const preparedAttachments = prepareMessageAttachments(messageAttachments)

  async function addFiles(files: Iterable<File>) {
    setIsAttaching(true)
    setErrorMessage(null)

    try {
      const result = await createComposerAttachments(files)

      setAttachments((current) => [...current, ...result.attachments])

      if (result.rejected_files.length > 0) {
        setErrorMessage(result.rejected_files.map((item) => item.reason).join(' '))
      }
    } finally {
      setIsAttaching(false)
    }
  }

  function removeAttachment(attachmentId: string) {
    setAttachments((current) =>
      current.filter((item) => item.attachment.id !== attachmentId),
    )
  }

  function clearComposer() {
    setAttachments([])
    setErrorMessage(null)
  }

  function captureSubmission(message: string) {
    const nextState = {
      message: message.trim(),
      request_attachments: preparedAttachments,
    }

    setSubmittedState(nextState)
    return nextState
  }

  return {
    attachments,
    messageAttachments,
    preparedAttachments,
    submittedState,
    isAttaching,
    errorMessage,
    addFiles,
    removeAttachment,
    clearComposer,
    captureSubmission,
  }
}
