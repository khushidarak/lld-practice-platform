type SubmissionContext = {
  problemId: string
  attemptId: string
}

function key(submissionId: string): string {
  return `lld-sub-ctx:${submissionId}`
}

export function rememberSubmissionContext(
  submissionId: string,
  context: SubmissionContext,
): void {
  sessionStorage.setItem(key(submissionId), JSON.stringify(context))
}

export function getSubmissionContext(submissionId: string): SubmissionContext | null {
  const raw = sessionStorage.getItem(key(submissionId))
  if (!raw) return null
  try {
    return JSON.parse(raw) as SubmissionContext
  } catch {
    return null
  }
}
