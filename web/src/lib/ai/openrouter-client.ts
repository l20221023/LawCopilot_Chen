import { prepareMessageAttachments } from './prepare-chat-attachments'
import { getScenarioById } from '../../features/scenarios'
import type { ChatMessage } from '../../types/chat'

type OpenRouterMessageContentPart =
  | {
      type: 'text'
      text: string
    }
  | {
      type: 'image_url'
      image_url: {
        url: string
      }
    }

type OpenRouterMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string | OpenRouterMessageContentPart[]
}

type ChatApiPayload = {
  conversationId: string
  messages: OpenRouterMessage[]
  scenarioId: string
}

type ChatStreamEvent = {
  delta: string
  finishReason: string | null
  modelName: string | null
  usage: {
    completion_tokens?: number
    prompt_tokens?: number
    total_tokens?: number
  } | null
}

type StreamChatCompletionOptions = {
  conversationId: string
  messages: OpenRouterMessage[]
  onEvent: (event: ChatStreamEvent) => void
  scenarioId: string
  signal?: AbortSignal
}

type StreamChatCompletionResult = {
  content: string
  finishReason: string | null
  modelName: string | null
  usage: ChatStreamEvent['usage']
}

function buildUserContent(message: ChatMessage) {
  const contentParts: OpenRouterMessageContentPart[] = []
  const trimmedContent = message.content.trim()

  if (trimmedContent) {
    contentParts.push({
      type: 'text',
      text: trimmedContent,
    })
  }

  const preparedAttachments = prepareMessageAttachments(message.attachments)

  for (const part of preparedAttachments.content_parts) {
    if (part.type === 'text') {
      contentParts.push({
        type: 'text',
        text: part.text,
      })
      continue
    }

    contentParts.push({
      type: 'image_url',
      image_url: {
        url: part.image_url.url,
      },
    })
  }

  if (contentParts.length === 0) {
    return ''
  }

  if (contentParts.length === 1 && contentParts[0].type === 'text') {
    return contentParts[0].text
  }

  return contentParts
}

function buildAssistantContent(message: ChatMessage) {
  return message.content.trim()
}

export function buildChatApiPayload(params: {
  conversationId: string
  messages: ChatMessage[]
  scenarioId: string
}): ChatApiPayload {
  const scenario = getScenarioById(params.scenarioId)
  const chatMessages: OpenRouterMessage[] = []

  if (scenario?.system_prompt) {
    chatMessages.push({
      role: 'system',
      content: scenario.system_prompt,
    })
  }

  for (const message of params.messages) {
    if (message.role === 'system') {
      continue
    }

    if (message.role === 'assistant') {
      chatMessages.push({
        role: 'assistant',
        content: buildAssistantContent(message),
      })
      continue
    }

    chatMessages.push({
      role: 'user',
      content: buildUserContent(message),
    })
  }

  return {
    conversationId: params.conversationId,
    messages: chatMessages,
    scenarioId: params.scenarioId,
  }
}

function extractDeltaContent(delta: unknown) {
  if (typeof delta === 'string') {
    return delta
  }

  if (!Array.isArray(delta)) {
    return ''
  }

  return delta
    .map((part) => {
      if (
        part &&
        typeof part === 'object' &&
        'type' in part &&
        (part as { type?: string }).type === 'text' &&
        'text' in part &&
        typeof (part as { text?: unknown }).text === 'string'
      ) {
        return (part as { text: string }).text
      }

      return ''
    })
    .join('')
}

function getErrorMessage(payload: unknown) {
  if (
    payload &&
    typeof payload === 'object' &&
    'error' in payload &&
    typeof payload.error === 'string'
  ) {
    const errorText = payload.error

    if (errorText.includes('not available in your region')) {
      return '当前模型在你所在的地区不可用，请在环境变量中切换为其他可用模型。'
    }

    return errorText
  }

  if (
    payload &&
    typeof payload === 'object' &&
    'error' in payload &&
    payload.error &&
    typeof payload.error === 'object' &&
    'message' in payload.error &&
    typeof payload.error.message === 'string'
  ) {
    if (payload.error.message.includes('not available in your region')) {
      return '当前模型在你所在的地区不可用，请在环境变量中切换为其他可用模型。'
    }

    return payload.error.message
  }

  if (typeof payload === 'string' && payload.trim()) {
    if (payload.includes('not available in your region')) {
      return '当前模型在你所在的地区不可用，请在环境变量中切换为其他可用模型。'
    }

    return payload
  }

  return '对话请求失败。'
}

export async function streamChatCompletion({
  conversationId,
  messages,
  onEvent,
  scenarioId,
  signal,
}: StreamChatCompletionOptions): Promise<StreamChatCompletionResult> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      conversationId,
      messages,
      scenarioId,
    } satisfies ChatApiPayload),
    signal,
  })

  if (!response.ok) {
    const fallbackText = await response.text()

    try {
      throw new Error(getErrorMessage(JSON.parse(fallbackText)))
    } catch {
      throw new Error(getErrorMessage(fallbackText))
    }
  }

  if (!response.body) {
    throw new Error('AI 响应流不可用。')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let accumulatedContent = ''
  let finishReason: string | null = null
  let modelName: string | null = null
  let usage: StreamChatCompletionResult['usage'] = null

  while (true) {
    const { done, value } = await reader.read()

    if (done) {
      break
    }

    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split('\n\n')
    buffer = events.pop() ?? ''

    for (const eventBlock of events) {
      const data = eventBlock
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim())
        .join('\n')

      if (!data || data === '[DONE]') {
        continue
      }

      const parsed = JSON.parse(data) as {
        choices?: Array<{
          delta?: {
            content?: unknown
          }
          finish_reason?: string | null
        }>
        model?: string
        usage?: StreamChatCompletionResult['usage']
      }

      const choice = parsed.choices?.[0]
      const delta = extractDeltaContent(choice?.delta?.content)
      modelName = parsed.model ?? modelName
      finishReason = choice?.finish_reason ?? finishReason
      usage = parsed.usage ?? usage

      if (delta) {
        accumulatedContent += delta
      }

      onEvent({
        delta,
        finishReason,
        modelName,
        usage,
      })
    }
  }

  return {
    content: accumulatedContent,
    finishReason,
    modelName,
    usage,
  }
}
