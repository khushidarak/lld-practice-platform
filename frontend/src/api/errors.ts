import type { ApiErrorBody } from '../types'

export class ApiError extends Error {
  readonly status: number
  readonly body: ApiErrorBody | null
  readonly submissionId?: string

  constructor(status: number, message: string, body: ApiErrorBody | null = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
    this.submissionId = body?.submissionId
  }
}

export function formatApiError(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return 'Something went wrong.'
}
