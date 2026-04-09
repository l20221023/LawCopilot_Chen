const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'
const DEFAULT_MAX_COMPLETION_TOKENS = 2048

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(payload))
}

function parsePositiveInteger(value, fallbackValue) {
  if (typeof value !== 'string' || !value.trim()) {
    return fallbackValue
  }

  const parsedValue = Number.parseInt(value, 10)

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return fallbackValue
  }

  return parsedValue
}

function getRequestBody(request) {
  if (request.body && typeof request.body === 'object') {
    return request.body
  }

  if (typeof request.body === 'string' && request.body.trim()) {
    return JSON.parse(request.body)
  }

  return null
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    sendJson(response, 405, {
      error: 'Method Not Allowed',
    })
    return
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  const model = process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash'
  const maxCompletionTokens = parsePositiveInteger(
    process.env.OPENROUTER_MAX_COMPLETION_TOKENS,
    DEFAULT_MAX_COMPLETION_TOKENS,
  )

  if (!apiKey) {
    sendJson(response, 500, {
      error: 'OPENROUTER_API_KEY is not configured on the server.',
    })
    return
  }

  let payload

  try {
    payload = getRequestBody(request)
  } catch {
    sendJson(response, 400, {
      error: 'Invalid JSON body.',
    })
    return
  }

  if (!payload || !Array.isArray(payload.messages) || payload.messages.length === 0) {
    sendJson(response, 400, {
      error: 'messages is required.',
    })
    return
  }

  let upstreamResponse

  try {
    upstreamResponse = await fetch(OPENROUTER_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...(process.env.OPENROUTER_SITE_URL
          ? { 'HTTP-Referer': process.env.OPENROUTER_SITE_URL }
          : {}),
        ...(process.env.OPENROUTER_APP_NAME
          ? { 'X-Title': process.env.OPENROUTER_APP_NAME }
          : {}),
      },
      body: JSON.stringify({
        model,
        messages: payload.messages,
        stream: true,
        max_completion_tokens: maxCompletionTokens,
        stream_options: {
          include_usage: true,
        },
      }),
    })
  } catch (error) {
    sendJson(response, 502, {
      error: error instanceof Error ? error.message : 'OpenRouter request failed.',
    })
    return
  }

  if (!upstreamResponse.ok || !upstreamResponse.body) {
    const errorText = await upstreamResponse.text()
    let message = errorText || 'OpenRouter request failed.'
    let details = null

    try {
      details = JSON.parse(errorText)
      message =
        details?.error?.message ||
        details?.message ||
        message
    } catch {
      details = null
    }

    sendJson(response, upstreamResponse.status || 502, {
      error: message,
      details,
    })
    return
  }

  response.statusCode = 200
  response.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  response.setHeader('Cache-Control', 'no-cache, no-transform')
  response.setHeader('Connection', 'keep-alive')

  const reader = upstreamResponse.body.getReader()

  while (true) {
    const { done, value } = await reader.read()

    if (done) {
      break
    }

    response.write(Buffer.from(value))
  }

  response.end()
}
