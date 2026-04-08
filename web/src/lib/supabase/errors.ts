import type { AuthServiceErrorCode } from '../../types/auth'

type SupabaseServiceErrorOptions = {
  cause?: unknown
  details?: string
}

export class SupabaseServiceError extends Error {
  code: AuthServiceErrorCode
  details?: string

  constructor(
    code: AuthServiceErrorCode,
    message: string,
    options: SupabaseServiceErrorOptions = {},
  ) {
    super(message, { cause: options.cause })
    this.name = 'SupabaseServiceError'
    this.code = code
    this.details = options.details
  }
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return 'Unexpected error.'
}
