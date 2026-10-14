import { describe, it, expect } from 'vitest'
import ts from 'typescript'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
// This file lives at backend/src/__tests__/, so three levels up is the repo root.
const repoRoot = path.resolve(here, '..', '..', '..')
const backendTypes = path.join(repoRoot, 'backend', 'src', 'types.ts')
const frontendTypes = path.join(repoRoot, 'frontend', 'src', 'types.ts')
const virtualPath = path.join(repoRoot, '__type_contract__.ts')

// A generated module that imports BOTH types files and pins the shared
// contract. Mutual<A, B> is true only when each type is assignable to the
// other; Widens is the one-directional check used where the frontend
// deliberately narrows the backend view (list summaries, poll payloads).
const CHECK_SOURCE = `
import type * as B from './backend/src/types'
import type * as F from './frontend/src/types'

type Mutual<A, B2> = [A, B2] extends [B2, A] ? true : false
type Widens<A, B2> = A extends B2 ? true : false

export const contract: [
  Mutual<B.SubmissionStatus, F.SubmissionStatus>,
  Mutual<B.ClassKind, F.ClassKind>,
  Mutual<B.DesignClass, F.DesignClass>,
  Mutual<B.SubmissionContent, F.SubmissionContent>,
  Mutual<B.Attempt, F.Attempt>,
  Mutual<B.AttemptSummary, F.AttemptSummary>,
  Mutual<B.CriterionResult, F.CriterionResult>,
  Mutual<B.Evaluation, F.Evaluation>,
  Mutual<B.WeakCriterion, F.WeakCriterion>,
  Mutual<B.Progress, F.Progress>,
  Mutual<B.Problem, F.ProblemDetail>,
  Widens<B.AttemptDetail, F.AttemptDetail>,
  Widens<B.SubmissionDetail, F.SubmissionDetail>,
  Widens<B.Problem, F.ProblemSummary>
] = [true, true, true, true, true, true, true, true, true, true, true, true, true, true]
`

function runContractCheck(): { loaded: boolean; errors: string[] } {
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    noEmit: true,
    skipLibCheck: true,
  }

  const host = ts.createCompilerHost(options)
  const originalGetSourceFile = host.getSourceFile.bind(host)
  const originalFileExists = host.fileExists.bind(host)
  const originalReadFile = host.readFile.bind(host)

  // Serve the contract module from memory so it never touches the repo.
  host.getSourceFile = (fileName, languageVersionOrOptions, shouldCreateNewSourceFile) => {
    if (path.resolve(fileName) === virtualPath) {
      return ts.createSourceFile(fileName, CHECK_SOURCE, languageVersionOrOptions, true)
    }
    return originalGetSourceFile(fileName, languageVersionOrOptions, shouldCreateNewSourceFile)
  }
  host.fileExists = f => path.resolve(f) === virtualPath || originalFileExists(f)
  host.readFile = f => (path.resolve(f) === virtualPath ? CHECK_SOURCE : originalReadFile(f))

  const program = ts.createProgram([virtualPath], options, host)
  const source = program.getSourceFile(virtualPath)
  if (!source) return { loaded: false, errors: ['contract module failed to load'] }

  const diagnostics = [
    ...program.getSyntacticDiagnostics(source),
    ...program.getSemanticDiagnostics(source),
  ]
  return {
    loaded: true,
    errors: diagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')),
  }
}

describe('shared type contract', () => {
  it('resolves both types files into the check program', () => {
    // Guards against a vacuous pass: if either import failed to resolve,
    // the diagnostics below would never mention the contract itself.
    const { loaded } = runContractCheck()
    expect(loaded).toBe(true)
    const backendProgram = ts.createProgram([backendTypes], { noEmit: true, skipLibCheck: true })
    const frontendProgram = ts.createProgram([frontendTypes], { noEmit: true, skipLibCheck: true })
    expect(backendProgram.getSourceFile(backendTypes)).toBeDefined()
    expect(frontendProgram.getSourceFile(frontendTypes)).toBeDefined()
  })

  it('keeps backend and frontend domain types assignable (no drift)', () => {
    const { errors } = runContractCheck()
    expect(errors).toEqual([])
  })
})
