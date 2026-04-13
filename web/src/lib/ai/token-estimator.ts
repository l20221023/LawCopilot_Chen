import { prepareMessageAttachments } from './prepare-chat-attachments'
import type { ChatMessage, MessageAttachment } from '../../types/chat'

// Heuristic: CJK characters are counted denser than Latin text, then add small structural overhead for prompts/messages.
const TOKEN_ESTIMATION_RULES = {
  latinOrNumberCharsPerToken: 4,
  symbolCharsPerToken: 6,
  lineBreaksPerToken: 2,
  messageBaseTokens: 4,
  messageAttachmentOverheadTokens: 6,
  systemPromptBaseTokens: 3,
} as const

const CJK_CHAR_PATTERN =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u
const LATIN_OR_NUMBER_CHAR_PATTERN = /[\p{Script=Latin}\p{Number}]/u
const WHITESPACE_CHAR_PATTERN = /\s/u

export type EstimateMessagesTokensOptions = {
  includeAttachmentText?: boolean
}

export type TokenEstimatorMessage = Pick<
  ChatMessage,
  'role' | 'content' | 'attachments'
>

export type EstimateRequestTokensInput = {
  systemPrompt?: string | null
  messages?: TokenEstimatorMessage[]
  attachmentText?: string | null
  includeSystemPrompt?: boolean
  includeMessageAttachmentText?: boolean
  estimatedOutputTokens?: number
}

export type EstimatedRequestTokens = {
  systemPromptTokens: number
  messagesTokens: number
  attachmentTextTokens: number
  inputTokens: number
  estimatedOutputTokens: number
  estimatedTotalTokens: number
  includedSystemPrompt: boolean
}

function normalizeText(text: string | null | undefined) {
  return text?.replace(/\r\n?/g, '\n').trim() ?? ''
}

function collectTextCharacterStats(text: string) {
  let cjkChars = 0
  let latinOrNumberChars = 0
  let symbolChars = 0
  let lineBreaks = 0

  for (const character of text) {
    if (character === '\n') {
      lineBreaks += 1
      continue
    }

    if (WHITESPACE_CHAR_PATTERN.test(character)) {
      continue
    }

    if (CJK_CHAR_PATTERN.test(character)) {
      cjkChars += 1
      continue
    }

    if (LATIN_OR_NUMBER_CHAR_PATTERN.test(character)) {
      latinOrNumberChars += 1
      continue
    }

    symbolChars += 1
  }

  return {
    cjkChars,
    latinOrNumberChars,
    symbolChars,
    lineBreaks,
  }
}

function estimateAttachmentTokensFromAttachments(attachments: MessageAttachment[]) {
  if (attachments.length === 0) {
    return 0
  }

  const extractedText = prepareMessageAttachments(attachments).extracted_text
  const textTokens = estimateAttachmentTextTokens(extractedText)

  if (textTokens === 0) {
    return 0
  }

  return textTokens + TOKEN_ESTIMATION_RULES.messageAttachmentOverheadTokens
}

export function estimateTextTokens(text: string | null | undefined) {
  const normalizedText = normalizeText(text)

  if (!normalizedText) {
    return 0
  }

  const { cjkChars, latinOrNumberChars, symbolChars, lineBreaks } =
    collectTextCharacterStats(normalizedText)

  const estimatedTokens =
    cjkChars +
    Math.ceil(
      latinOrNumberChars / TOKEN_ESTIMATION_RULES.latinOrNumberCharsPerToken,
    ) +
    Math.ceil(symbolChars / TOKEN_ESTIMATION_RULES.symbolCharsPerToken) +
    Math.ceil(lineBreaks / TOKEN_ESTIMATION_RULES.lineBreaksPerToken)

  return Math.max(1, estimatedTokens)
}

export function estimateAttachmentTextTokens(
  attachmentText: string | null | undefined,
) {
  return estimateTextTokens(attachmentText)
}

export function estimateMessageTokens(
  message: TokenEstimatorMessage,
  options: EstimateMessagesTokensOptions = {},
) {
  const { includeAttachmentText = true } = options

  const contentTokens = estimateTextTokens(message.content)
  const attachmentTokens = includeAttachmentText
    ? estimateAttachmentTokensFromAttachments(message.attachments)
    : 0

  if (contentTokens === 0 && attachmentTokens === 0) {
    return 0
  }

  return (
    TOKEN_ESTIMATION_RULES.messageBaseTokens + contentTokens + attachmentTokens
  )
}

export function estimateMessagesTokens(
  messages: TokenEstimatorMessage[],
  options: EstimateMessagesTokensOptions = {},
) {
  return messages.reduce(
    (total, message) => total + estimateMessageTokens(message, options),
    0,
  )
}

export function estimateRequestTokens({
  systemPrompt,
  messages = [],
  attachmentText,
  includeSystemPrompt = true,
  includeMessageAttachmentText = true,
  estimatedOutputTokens = 0,
}: EstimateRequestTokensInput): EstimatedRequestTokens {
  const systemPromptTextTokens = includeSystemPrompt
    ? estimateTextTokens(systemPrompt)
    : 0
  const systemPromptTokens =
    systemPromptTextTokens > 0
      ? systemPromptTextTokens + TOKEN_ESTIMATION_RULES.systemPromptBaseTokens
      : 0
  const messagesTokens = estimateMessagesTokens(messages, {
    includeAttachmentText: includeMessageAttachmentText,
  })
  const attachmentTextTokens = estimateAttachmentTextTokens(attachmentText)
  const inputTokens = systemPromptTokens + messagesTokens + attachmentTextTokens

  return {
    systemPromptTokens,
    messagesTokens,
    attachmentTextTokens,
    inputTokens,
    estimatedOutputTokens: Math.max(0, Math.ceil(estimatedOutputTokens)),
    estimatedTotalTokens:
      inputTokens + Math.max(0, Math.ceil(estimatedOutputTokens)),
    includedSystemPrompt:
      includeSystemPrompt && systemPromptTokens > 0,
  }
}
