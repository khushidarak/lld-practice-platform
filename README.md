# LLD Practice Platform

A focused practice loop for Low-Level Design: **choose a problem → write a structured design → submit → get criterion-by-criterion feedback → review history → try again.**

Learners write their design as structured text (assumptions, classes/interfaces with responsibilities, relationships, key flow, trade-offs). The platform grades it against a **rubric** (not a reference solution, so different valid designs can score well) and quotes evidence from the learner's own text.

- Design note: [docs/DESIGN.md](docs/DESIGN.md)
- Research note: [docs/RESEARCH.md](docs/RESEARCH.md)
- AI usage: [AI_USAGE.md](AI_USAGE.md)

## Run it

Requires Node 19+ and npm. The backend uses the global `crypto` and `fetch` APIs without imports (Node exposes both by default from v19) and TypeScript targets ES2022.

### 1. Backend (port 3000)

```bash
cd backend
npm install
npm run dev
```

Evaluation works with **no API key**: only the deterministic rule checks run, and results are labelled *degraded*. To enable LLM-judged criteria (responsibilities, coupling, trade-offs, extensibility):

```bash
OPENAI_API_KEY=sk-... npm run dev
```

### 2. Frontend (port 5173)

```bash
cd frontend
cp .env.example .env      # VITE_API_URL=http://localhost:3000/api, VITE_USE_MOCK=false
npm install
npm run dev
```

Open http://localhost:5173.

**Mock mode (no backend needed):** set `VITE_USE_MOCK=true` in `frontend/.env`. This uses a localStorage client with canned LLM results. Put `FORCE_FAIL` or `FORCE_DEGRADED` in the *assumptions* field to demo the failure and degraded paths.

### Tests

```bash
cd backend && npm test      # 70 tests: evaluators, service, API, progress, type drift
cd frontend && npm test     # 44 tests: form validation and mock client
```

## How it works

### Learner flow

1. **Choose problem**: Parking Lot, Elevator, Vending Machine, LRU Cache.
2. **Start an attempt** and fill in the design form.
3. **Submit**: status goes `SUBMITTED → EVALUATING → COMPLETED | FAILED`.
4. **Read feedback**: each criterion has a score (0-4), quoted evidence, a concern, a suggestion and a confidence.
5. **Review**: attempt history and the learner's most recurring weak criteria.
6. **Retry**: each problem has a change request (e.g. "add EV charging spots") to practise evolving a design.

### Core design (backend/src)

| Type | Responsibility |
|---|---|
| `Evaluator` (interface) | Grades a design and returns `CriterionResult[]`. The extension point for new evaluation approaches. |
| `RuleBasedEvaluator` | Deterministic checks: sections present, class count, class completeness, keyword requirement coverage (low confidence). |
| `LLMEvaluator` | Judgement criteria via an LLM with a fixed rubric, JSON output, low temperature and a timeout. Validates untrusted output (unknown criteria dropped, scores clamped to 0-4). |
| `CompositeEvaluator` | Runs rules, then the judgement evaluator, and merges. If the judgement evaluator fails, falls back to rule results. |
| `EvaluationService` | Owns the submission lifecycle and the state machine. Takes any `Evaluator`, so it never depends on OpenAI. |
| `*Repository` | Storage access for problems, attempts and submissions. |
| `ProgressAnalyzer` | Averages criterion scores across completed submissions to find recurring weaknesses. |
| `createApp()` | Wires routes and the service, separate from `listen()` so tests can run it. |

### Criteria

Eight criteria in total — four rule checks and four LLM-judged:

| Rule checks (`RuleBasedEvaluator`) | LLM criteria (`LLMEvaluator`) |
|---|---|
| `sections-present` — all five sections filled in | `responsibilities` — are responsibilities assigned to focused classes? |
| `minimum-classes` — a sensible number of types | `coupling` — is coupling reasonable, are interfaces used well? |
| `requirement-coverage` — keyword match per requirement (low confidence) | `tradeoffs` — are trade-offs and their costs discussed? |
| `class-completeness` — every class has a responsibility and methods | `extensibility` — how well would the design absorb the change request? |

The overall score is the unweighted mean of all returned criteria (0-4 each), rounded to one decimal.

### Deterministic vs LLM

- **Deterministic:** anything checkable from structure (is a section blank? does a class have methods?). Same input, same output, free, instantly explainable.
- **LLM:** things that need judgement (are responsibilities cohesive? is coupling reasonable?). It's constrained by a fixed rubric and must cite evidence.
- On overlap, **rule results win**.

### API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/problems`, `/api/problems/:id` | List problems / full requirements and change request |
| POST | `/api/attempts` | Start an attempt `{ problemId }` |
| GET | `/api/attempts`, `/api/attempts/:id` | History / one attempt with its submissions |
| POST | `/api/submissions` | Submit `{ attemptId, content }` (201 / 400 / 404 / 409) |
| GET | `/api/submissions/:id` | Status and evaluation |
| POST | `/api/submissions/:id/retry` | Retry a `FAILED` submission |
| GET | `/api/progress` | Weakest criteria across attempts |
| GET | `/api/health` | `{ status, llm }` |

### Slow or failed evaluation

- The submission is persisted *before* evaluation, and the API returns immediately with `SUBMITTED`. The client polls.
- LLM calls have a 30 s timeout. Any LLM failure (timeout, bad JSON, no valid criteria) degrades to rule-only feedback, shown as degraded.
- If everything fails, the submission becomes `FAILED` with a reason, and the learner can **retry** it.
- Re-submitting an identical design to the same attempt returns `409`.

## Key decisions

- **Text-only submission.** The smallest format that still shows design reasoning. No code runner or diagram editor needed. New formats slot in via `SubmissionContent`.
- **Rubric, not reference solution**, so alternative valid designs are accepted.
- **Simple monolith** (Express). No queue or microservices.
- **Dependency injection at the seams** (`Evaluator`, `ChatClient`) so failure paths are testable without network calls.

## Limitations

- **Storage is in-memory.** The backend loses all data on restart — attempt history resets. A real deployment would swap the repositories for a database; nothing outside `database.ts` and the repositories would need to change.
- **Evaluation runs in-process.** A crash mid-evaluation leaves a submission in `EVALUATING`; the startup sweep re-runs those on the next boot. (With in-memory storage a restart also wipes everything, so this matters once storage is persistent.)
- **No auth or multi-user.** All attempts belong to one anonymous learner.
- **Keyword requirement matching is a heuristic** (labelled low confidence) and can miss synonyms.
- **LLM judgement varies** and there's no human-calibrated set yet.
- **Duplicate detection** compares serialised content, so trivial whitespace changes count as a new design.
- **Mock mode** uses time-based status transitions for demo purposes only.
