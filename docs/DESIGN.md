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

| Class / interface | Responsibility | Depends on |
|---|---|---|
| `Problem` | Title, requirements, hints, change request | nothing |
| `Rubric` | Ordered list of `Criterion`; defines what is evaluated | `Criterion` |
| `Criterion` | Id, name, description, weight, kind (rule or judgement) | nothing |
| `Attempt` | One learner's try at a problem; owns its submissions; number and timestamps | `Problem` |
| `Submission` | Immutable content snapshot, content hash, status | `SubmissionContent` |
| `SubmissionContent` (interface) | `validate()`, `toEvaluationText()`; today `TextDesignContent` | nothing |
| `SubmissionStatus` (enum + transitions) | `SUBMITTED -> EVALUATING -> COMPLETED / FAILED`; rejects illegal moves | nothing |
| `Evaluator` (interface) | `evaluate(submission, rubric) -> List<CriterionResult>` | rubric |
| `RuleBasedEvaluator` | Deterministic checks (see section 5) | nothing external |
| `LLMEvaluator` | Judgement criteria via a fixed prompt, JSON output, validation | `LLMClient` |
| `CompositeEvaluator` | Runs several evaluators and merges results per criterion | `Evaluator[]` |
| `LLMClient` (interface) | `complete(prompt) -> string`; real and fake implementations | nothing |
| `CriterionResult` | Score, evidence, concern, suggestion, confidence, source (rule or LLM) | nothing |
| `Evaluation` | All results for a submission, overall summary, status | `CriterionResult` |
| `EvaluationService` | Orchestrates: persist, mark evaluating, run evaluator, save, handle failure | `Evaluator`, repositories |
| `AttemptRepository`, `ProblemRepository` | Persistence behind interfaces | storage |
| `ProgressAnalyzer` | Computes per-criterion trend and recurring weaknesses from history | `Evaluation` history |

### Why these abstractions (and not others)

- `Evaluator`, `SubmissionContent`, `LLMClient` and the repositories are the points I expect to change: new evaluator type, new format, new model vendor, new storage. Each has a concrete reason.
- `Problem`, `Rubric`, `Attempt` are plain data-owning classes; no interfaces without a second implementation in sight.
- I deliberately avoid a pattern zoo. Strategy appears once (`Evaluator`), Composite once (`CompositeEvaluator`), because both solve a stated change test.

## 5. Evaluation approach

### Feedback shape

Every criterion produces:

`criterion -> score (0-4) -> evidence (quoted from learner text) -> concern -> suggestion -> confidence`

A 0-4 anchored scale (for example: 0 missing, 2 partial, 4 strong) with a descriptor per level keeps both rules and the LLM consistent. There is no single "100-point AI score"; the overall result is a weighted summary of criteria.

### Handling multiple valid solutions

The rubric judges **properties of a design**, not similarity to a reference. A reference outline exists only as a *hint set* for the LLM ("typical responsibilities include..."), explicitly marked as non-exhaustive. The prompt instructs: accept alternative structures that satisfy the criterion, and quote evidence for every score.

### Deterministic vs LLM

| Deterministic (RuleBasedEvaluator) | LLM (LLMEvaluator) |
|---|---|
| All required sections present and non-trivial | Quality of responsibility assignment |
| Minimum number of classes; each has a stated responsibility | Coupling / cohesion judgement |
| Requirement coverage: each problem requirement is mentioned (keyword/alias match, flagged as heuristic) | Trade-off reasoning quality |
| Duplicate class names, empty fields | Extensibility versus the change request |
| Status transitions, idempotency, hash dedupe | Improvement suggestions and explanation quality |

Rules are cheap, explainable and repeatable, so they handle structure. The LLM handles what needs judgement, and its output is constrained: fixed rubric, JSON schema, low temperature, evidence required. LLM output is validated (all criteria present, scores in range, evidence string present); invalid output counts as a failure, not as a result.

### Merging

`CompositeEvaluator` combines results per criterion. Rule results take precedence for the criteria they own. The LLM covers the rest. Each `CriterionResult` records its source so the UI can show "checked by rule" vs "assessed by AI" and a confidence level.

## 6. Reliability

- **Persist first.** The submission and an `Evaluation` row in `SUBMITTED` state are saved before any evaluator runs.
- **Non-blocking.** `POST /submissions` returns immediately with the id; evaluation runs in the background. The UI polls `GET /submissions/:id` for status.
- **State machine.** `SUBMITTED -> EVALUATING -> COMPLETED | FAILED`, with illegal transitions rejected in one place (`SubmissionStatus`).
- **Idempotency.** Content hash plus attempt id: resubmitting identical content returns the existing submission rather than creating a duplicate or re-evaluating.
- **Failure handling.** LLM timeout or malformed JSON leads to `FAILED` with a reason, **or** a degraded `COMPLETED` carrying rule-based results only, clearly labelled "AI feedback unavailable". A `FAILED` submission can be retried without re-entering content.
- **Growth.** If load grows, the first component I would separate is the evaluation worker (queue plus worker), because it is the slow, failure-prone part. The domain model does not change; `EvaluationService` just enqueues instead of running in-process.

## 7. Change tests

**A. Add a class-diagram submission format.** Add `DiagramContent implements SubmissionContent` and, if needed, a new evaluator that reads it. `Attempt`, `Submission`, the state machine and the history are untouched.

**B. Add a rule-based or human reviewer.** Implement `Evaluator` (e.g. `HumanReviewEvaluator`) and register it in the `CompositeEvaluator`. The practice flow (`EvaluationService`) does not change.

## 8. Trade-offs and limitations

- **Text-only** means no executable proof and relies on the learner's honesty and clarity; accepted for a 2-day MVP.
- **Keyword requirement matching is heuristic**, so it can miss synonyms or give false hits. Results are labelled lower confidence and the LLM cross-checks.
- **LLM judgement varies** between runs and models. Mitigations: fixed rubric, low temperature, evidence requirement, validation. No human calibration set in the MVP; that is the first quality step I would add.
- **In-process background work** loses in-flight jobs on a crash. Because `EVALUATING` is persisted, a startup sweep can re-queue stuck submissions.
- **No auth, multi-user, or payments.** Out of scope for the practice loop.
