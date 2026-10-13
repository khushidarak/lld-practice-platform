# LLD Practice Platform

A 2-day engineering assignment to build a focused LLD practice experience. Learners choose a problem, write a structured text design, submit it, and receive criterion-by-criterion feedback with evidence from their own work.

## Overview

This MVP demonstrates a complete practice loop:

1. **Choose problem** from 4 classic LLD problems (Parking Lot, Elevator, Vending Machine, LRU Cache)
2. **Write design** in a structured form: assumptions, classes with responsibilities, relationships, key flow, trade-offs
3. **Submit** and see the evaluation status transition through SUBMITTED → EVALUATING → COMPLETED/FAILED
4. **Get feedback** per criterion (requirement coverage, responsibilities, coupling, trade-offs, extensibility, explanation)
5. **Review** past attempts and see recurring weaknesses by criterion
6. **Retry** with a change request (e.g., "add EV charging spots") to practice extensibility

The submission format is structured text rather than code or diagrams. This is the smallest format that still reveals design reasoning, and it avoids needing a code runner or visual editor in the MVP.

## Architecture

### Design approach

- **Rubric-first evaluation**, not reference solution comparison. Multiple valid designs can score well on the same criteria.
- **Deterministic checks first, LLM second.** Structure and completeness are rule-checked; judgement-heavy criteria go to the LLM with a fixed rubric and JSON output.
- **Evidence-linked feedback.** Every criterion returns score, evidence quoted from the learner's text, concern, suggestion, and confidence.
- **State machine reliability.** SUBMITTED → EVALUATING → COMPLETED/FAILED with persistence-first, idempotency via content hash, and retry on failure.
- **Extensibility points.** `SubmissionContent`, `Evaluator`, and `LLMClient` are interfaces where variation is expected (new formats, new evaluators, new models).

### Current implementation

The prototype is a **frontend-only mock** that demonstrates the full practice flow using localStorage instead of a real backend. The mock implements:

- Full domain model (Problem, Attempt, Submission, Evaluation, Rubric, Criterion)
- State machine with time-based transitions for demo purposes
- Deterministic validation (required sections, non-empty fields, minimum classes)
- Simulated LLM evaluation with canned results
- Progress analyzer that computes per-criterion trends
- Idempotency via content hash
- Failure scenarios (FORCE_FAIL, FORCE_DEGRADED in assumptions text)

See [docs/DESIGN.md](docs/DESIGN.md) for the complete design note, including domain model, evaluation approach, change tests, and trade-offs.

## Run the project

### Prerequisites

- Node.js 18+
- npm

### Frontend (mock mode)

The mock mode uses localStorage and a simulated API. No backend is required.

```bash
cd frontend
cp .env.example .env
# Edit .env and set VITE_USE_MOCK=true
npm install
npm run dev
```

Open http://localhost:5173.

### Frontend (with real backend)

If you implement the backend described in the design note:

```bash
cd frontend
cp .env.example .env
# Edit .env and set VITE_API_URL to your backend URL
npm install
npm run dev
```

### Testing

```bash
cd frontend
npm test
```

## Project structure

```
lld/
├── docs/
│   ├── RESEARCH.md       # 1-2 page research: learner problem, existing tools, gaps, product direction
│   └── DESIGN.md          # MVP explanation, user flow, domain model, evaluation approach, trade-offs
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   ├── client.ts         # API client interface
│   │   │   ├── mockClient.ts     # Mock implementation with localStorage
│   │   │   └── errors.ts         # Error types
│   │   ├── components/           # React components (DesignForm, CriterionCard, etc.)
│   │   ├── pages/                # Page components (ProblemsPage, ProblemPage, etc.)
│   │   ├── types.ts              # TypeScript types for domain model
│   │   └── App.tsx               # Main app with routing
│   └── package.json
├── AI_USAGE.md                 # 3-5 meaningful AI-assisted decisions
└── README.md                   # This file
```

## Key decisions and limitations

### Decisions

- **Text-only submission.** Avoids code runner complexity and visual editor overhead. Can add code/diagram formats later via `SubmissionContent` interface.
- **Rubric, not reference solution.** Accepts alternative valid designs. Focuses on properties of the design (responsibilities, coupling, extensibility) rather than similarity to a single answer.
- **Mock prototype.** Demonstrates the full flow without building a real backend. The design document describes the monolith architecture that would replace the mock.
- **No auth, multi-user, or payments.** Out of scope for the practice loop. The assignment focuses on LLD/domain design, not a full LMS.

### Limitations

- **Text submission relies on learner honesty.** No executable proof that the design actually works. Accepted for a 2-day MVP.
- **Keyword requirement matching is heuristic.** Can miss synonyms or give false hits. Results are labelled lower confidence and the LLM cross-checks.
- **LLM judgement varies.** No human calibration set in the MVP. Mitigations: fixed rubric, low temperature, evidence requirement, validation.
- **In-process background work loses in-flight jobs on crash.** Because `EVALUATING` is persisted, a startup sweep can re-queue stuck submissions.
- **Mock time-based transitions.** In the real implementation, state transitions would be event-driven (evaluator started, completed, failed) rather than time-based.

## Next steps for a production implementation

1. **Replace mock with real backend:**
   - Implement `EvaluationService` with `RuleBasedEvaluator` and `LLMEvaluator`
   - Add database persistence (PostgreSQL or similar)
   - Implement real LLM integration (OpenAI, Anthropic, or local model)
   - Add a queue for background evaluation (e.g., BullMQ or simple in-memory queue)

2. **Add tests:**
   - Unit tests for evaluation logic (rule-based checks, LLM prompt construction)
   - Integration tests for the full practice flow
   - Tests for failure scenarios (LLM timeout, malformed JSON, queue errors)

3. **Calibrate and improve evaluation:**
   - Add human-graded examples to calibrate the LLM
   - Refine rubric based on real learner submissions
   - Add more granular criteria if needed

## Resources

- [docs/RESEARCH.md](docs/RESEARCH.md) - Research note with competitor analysis and product direction
- [docs/DESIGN.md](docs/DESIGN.md) - Design note with domain model, evaluation approach, and trade-offs
- [AI_USAGE.md](AI_USAGE.md) - AI-assisted decisions made during development
- [frontend/README.md](frontend/README.md) - Frontend-specific documentation
