# Design Note: LLD Practice Platform MVP

## 1. MVP in one paragraph

A learner picks one of four LLD problems (Parking Lot, Elevator, Vending Machine, LRU Cache), writes a structured text design, submits it, and receives criterion-by-criterion feedback. They can review past attempts, see which criteria they repeatedly miss, and retry with a change request. It is a single monolith with a small database.

## 2. User flow

```
Choose problem -> Start attempt -> Write design -> Submit
      ^                                              |
      |                                   SUBMITTED -> EVALUATING
      |                                              |
 Retry w/ change request <- Review feedback <- COMPLETED / FAILED (retry)
                                   |
                            Attempt history + weak-criteria trend
```

## 3. What the learner provides

A meaningful attempt needs enough evidence to judge reasoning, not just a class list. The submission is a form with sections:

1. **Assumptions / clarified requirements**
2. **Classes and interfaces**, each with its responsibility and key methods
3. **Relationships** (has-a, is-a, depends-on)
4. **Key flow**, e.g. what happens on "park a car"
5. **Trade-offs and extension points**

This is the smallest format that reveals responsibilities, abstractions, and reasoning. Code and diagrams prove more but cost far more to build and evaluate; they are future `SubmissionContent` types.

## 4. Core domain model

These are the types that exist in `backend/src/types.ts` and the classes around them:

| Class / interface | Responsibility | Depends on |
|---|---|---|
| `Problem` | Title, requirements, assumptions, change request | nothing |
| `Attempt` | One learner's try at a problem; number and timestamps | `Problem` |
| `Submission` | Immutable content snapshot, content hash, status | `SubmissionContent` |
| `SubmissionContent` (interface) | Plain data shape: assumptions, classes, relationships, key flow, trade-offs. Validation lives in the route (`validateContent` in `routes/submissions.ts`), not on the type | nothing |
| `SubmissionStatus` (union type) | `SUBMITTED \| EVALUATING \| COMPLETED \| FAILED`; transitions are enforced by a guard in `EvaluationService`, not by the type | nothing |
| `Evaluator` (interface) | `evaluate(content, requirements) -> CriterionResult[]`; the strategy seam | nothing |
| `RuleBasedEvaluator` | The four deterministic checks (see section 5) | nothing external |
| `LLMEvaluator` | The four judgement criteria via a fixed prompt, JSON output, output validation | `ChatClient` |
| `CompositeEvaluator` | Runs the rule evaluator then the judgement evaluator and merges per criterion | `Evaluator`, rule evaluator |
| `ChatClient` (interface) | The slice of the OpenAI SDK we call (`chat.completions.create`); real SDK or injected fake | nothing |
| `CriterionResult` | Score, evidence, concern, suggestion, confidence, source (rule or llm) | nothing |
| `Evaluation` | All results for a submission, overall score, summary, degraded flag | `CriterionResult` |
| `EvaluationService` | Orchestrates: guard transition, mark evaluating, run evaluator, save, handle failure; also the startup sweep | `Evaluator`, repositories |
| `ProblemRepository`, `AttemptRepository`, `SubmissionRepository` | Storage access over the in-memory maps | storage |
| `ProgressAnalyzer` | Per-criterion averages across completed submissions, weakest first | `SubmissionRepository` |

### Why these abstractions (and not others)

- `Evaluator`, `ChatClient` and the repositories are the points I expect to change: new evaluator type, new model vendor, new storage. Each has a concrete reason.
- `Problem`, `Attempt`, `Submission` are plain data-owning types; no interfaces without a second implementation in sight.
- I deliberately avoid a pattern zoo. Strategy appears once (`Evaluator`), Composite once (`CompositeEvaluator`), because both solve a stated change test.
- No `Rubric` or `Criterion` classes: the eight criteria are named constants inside the evaluators (four rule ids, `LLM_CRITERIA` for the LLM). If a second rubric ever appears, that is the point to extract them.

## 5. Evaluation approach

### Feedback shape

Every criterion produces:

`criterion -> score (0-4) -> evidence (quoted from learner text) -> concern -> suggestion -> confidence`

A 0-4 anchored scale (0 missing, 1 weak, 2 partial, 3 good, 4 strong) keeps both rules and the LLM consistent. There is no single "100-point AI score"; the overall result is the unweighted mean of the criteria returned for the submission.

### Handling multiple valid solutions

The rubric judges **properties of a design**, not similarity to a reference. A reference outline exists only as a *hint set* for the LLM ("typical responsibilities include..."), explicitly marked as non-exhaustive. The prompt instructs: accept alternative structures that satisfy the criterion, and quote evidence for every score.

### Deterministic vs LLM

| Deterministic (RuleBasedEvaluator) | LLM (LLMEvaluator) |
|---|---|
| `sections-present` — all five sections filled | `responsibilities` — quality of responsibility assignment |
| `minimum-classes` — a sensible number of types | `coupling` — coupling / cohesion judgement |
| `requirement-coverage` — each requirement's keywords appear in the text (heuristic, low confidence) | `tradeoffs` — trade-off reasoning quality |
| `class-completeness` — each class has a responsibility and methods | `extensibility` — how well the design absorbs the change request |

The overall score is the unweighted mean of all returned criteria, rounded to one decimal. Eight criteria in total.

Rules are cheap, explainable and repeatable, so they handle structure. The LLM handles what needs judgement, and its output is constrained: fixed rubric, JSON schema, low temperature, evidence required. LLM output is validated (all criteria present, scores in range, evidence string present); invalid output counts as a failure, not as a result.

### Merging

`CompositeEvaluator` combines results per criterion. Rule results take precedence for the criteria they own (the two sets are disjoint today, but the rule holds). The LLM covers the rest. Each `CriterionResult` records its source so the UI can show "checked by rule" vs "assessed by AI" and a confidence level.

### Timeout

LLM calls carry a 30 s timeout (`LLM_TIMEOUT_MS` passed to the SDK). A timeout surfaces as a rejected call, which `LLMEvaluator` turns into a thrown `LLM evaluation failed`; the composite falls back to rule results exactly as for any other LLM failure, so a slow model can never stall a submission past ~30 s.

## 6. Reliability

- **Persist first.** The submission is saved in `SUBMITTED` state before any evaluator runs; the evaluation is written only once it exists.
- **Non-blocking.** `POST /submissions` returns immediately with the id; evaluation runs in the background. The UI polls `GET /submissions/:id` for status.
- **State machine.** `SUBMITTED -> EVALUATING -> COMPLETED | FAILED`, with a guard in `EvaluationService`: only `SUBMITTED` or `FAILED` may move to `EVALUATING`, and it throws before touching the status otherwise. Retry resets a `FAILED` submission to `SUBMITTED`, clearing `evaluatingAt`, `completedAt` and `failureReason` explicitly.
- **Duplicate handling.** Content hash plus attempt id: resubmitting identical content to the same attempt returns `409 Conflict` (the frontend surfaces a link to the existing submission). A revised design in the same attempt, or the same design in a different attempt, is accepted.
- **Failure handling.** An LLM failure — timeout, malformed JSON, no valid criteria — degrades to a `COMPLETED` evaluation carrying rule-based results only, with `degraded: true`, which the UI labels "AI feedback unavailable". Only a total evaluation failure (e.g. the rule evaluator itself throws) ends in `FAILED` with a `failureReason`, and only `FAILED` submissions can be retried without re-entering content.
- **Startup sweep.** On boot, `EvaluationService.requeueStuckSubmissions()` finds submissions left in `EVALUATING` by an unclean shutdown, resets them to `SUBMITTED` and re-runs evaluation, so a crash mid-evaluation never strands a submission.
- **Growth.** If load grows, the first component I would separate is the evaluation worker (queue plus worker), because it is the slow, failure-prone part. The domain model does not change; `EvaluationService` just enqueues instead of running in-process.

## 7. Change tests

**A. Add a class-diagram submission format.** Widen the `SubmissionContent` type (or add a discriminated union) with the diagram fields, teach `validateContent` about them, and add an evaluator that reads them. `Attempt`, `Submission`, the state machine and the history are untouched.

**B. Add a rule-based or human reviewer.** Implement `Evaluator` (e.g. `HumanReviewEvaluator`) and register it in the `CompositeEvaluator`. The practice flow (`EvaluationService`) does not change.

## 8. Trade-offs and limitations

- **Text-only** means no executable proof and relies on the learner's honesty and clarity; accepted for a 2-day MVP.
- **Keyword requirement matching is heuristic**, so it can miss synonyms or give false hits. Results are labelled lower confidence and the LLM cross-checks.
- **LLM judgement varies** between runs and models. Mitigations: fixed rubric, low temperature, evidence requirement, validation. No human calibration set in the MVP; that is the first quality step I would add.
- **In-process background work** loses in-flight jobs on a crash. Because `EVALUATING` is persisted, the startup sweep re-queues stuck submissions on the next boot (see section 6).
- **No auth, multi-user, or payments.** Out of scope for the practice loop.
