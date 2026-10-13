import type {
  ApiErrorBody,
  Attempt,
  AttemptDetail,
  AttemptSummary,
  CreateSubmissionResponse,
  ProblemDetail,
  ProblemSummary,
  Progress,
  SubmissionContent,
  SubmissionDetail,
} from '../types'
import { ApiError } from './errors'
import * as mock from './mockClient'

export { ApiError, formatApiError } from './errors'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api'
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

function messageFromBody(status: number, body: ApiErrorBody | null, fallback: string): string {
  if (body?.error) return body.error
  if (body?.message) return body.message
  if (Array.isArray(body?.errors)) return body.errors.join(' ')
  if (body?.errors && typeof body.errors === 'object') {
    return Object.values(body.errors).join(' ')
  }
  if (status === 400) return 'The server rejected this design. Check the form and try again.'
  if (status === 409) return 'This design was already submitted.'
  if (status >= 500) return 'The server had a problem. Try again in a moment.'
  return fallback
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    })
  } catch {
    throw new ApiError(0, 'Could not reach the API. Is the server running?')
  }

  const text = await response.text()
  let body: ApiErrorBody | T | null = null
  if (text) {
    try {
      body = JSON.parse(text) as ApiErrorBody | T
    } catch {
      body = null
    }
  }

  if (!response.ok) {
    const errBody = (body as ApiErrorBody | null) ?? null
    throw new ApiError(
      response.status,
      messageFromBody(response.status, errBody, response.statusText),
      errBody,
    )
  }

  return body as T
}

async function listProblems(): Promise<ProblemSummary[]> {
  return request<ProblemSummary[]>('/problems')
}

async function getProblem(id: string): Promise<ProblemDetail> {
  return request<ProblemDetail>(`/problems/${id}`)
}

async function createAttempt(problemId: string): Promise<Attempt> {
  return request<Attempt>('/attempts', {
    method: 'POST',
    body: JSON.stringify({ problemId }),
  })
}

async function listAttempts(): Promise<AttemptSummary[]> {
  return request<AttemptSummary[]>('/attempts')
}

async function getAttempt(id: string): Promise<AttemptDetail> {
  return request<AttemptDetail>(`/attempts/${id}`)
}

async function createSubmission(
  attemptId: string,
  content: SubmissionContent,
): Promise<CreateSubmissionResponse> {
  return request<CreateSubmissionResponse>(`/attempts/${attemptId}/submissions`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  })
}

async function getSubmission(id: string): Promise<SubmissionDetail> {
  return request<SubmissionDetail>(`/submissions/${id}`)
}

async function retrySubmission(id: string): Promise<CreateSubmissionResponse> {
  return request<CreateSubmissionResponse>(`/submissions/${id}/retry`, {
    method: 'POST',
  })
}

async function getProgress(): Promise<Progress> {
  return request<Progress>('/progress')
}

const httpApi = {
  listProblems,
  getProblem,
  createAttempt,
  listAttempts,
  getAttempt,
  createSubmission,
  getSubmission,
  retrySubmission,
  getProgress,
}

export const api = USE_MOCK ? mock.mockApi : httpApi
