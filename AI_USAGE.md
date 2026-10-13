# AI Usage in LLD Practice Platform

This document describes 3-5 meaningful AI-assisted decisions made during the development of this project.

## 1. Research question formulation and competitor analysis

**What AI suggested:** I asked the AI to help formulate research questions for understanding the LLD practice problem and to identify key gaps in existing tools. The AI suggested framing the problem around three core difficulties: lack of single right answer, missing feedback loop, and no memory across attempts. It also proposed a structured comparison framework for existing tools (format, feedback, observations).

**What I accepted:** I accepted the three-framing approach and the comparison table structure. This helped me quickly categorize AlgoMaster, Hello Interview, Educative, and community approaches around consistent dimensions rather than getting lost in feature lists.

**What I rejected:** The AI initially suggested a broader landscape including video courses and general coding practice platforms. I rejected this because the assignment is specifically about LLD practice, not general learning. Focusing narrowly on tools that actually review LLD designs was more useful.

**Why:** The narrow framing kept research to 2-3 hours as the assignment guide suggests, and the comparison table made it easy to spot that existing tools lean heavily on code/long sessions and produce score-based feedback—both gaps the MVP should address.

## 2. Submission format decision (text vs code vs diagram)

**What AI suggested:** When I asked whether to support code, diagrams, or text for the MVP, the AI suggested starting with text because it's the smallest format that still reveals design reasoning. It argued that code requires a language-specific runner and diagrams need a complex visual editor, both of which would eat into the 2-day timeline. It also pointed out that responsibilities, relationships, and trade-offs can all be expressed in text.

**What I accepted:** I accepted text-only submission for the MVP. The structured form (assumptions, classes with responsibilities, relationships, key flow, trade-offs) maps directly to the evaluation criteria.

**What I rejected:** The AI suggested adding a "diagram export" feature where users could upload a PNG alongside text. I rejected this because the MVP doesn't have a way to parse diagrams, and adding a UI for upload without evaluation logic would be feature creep.

**Why:** Text is sufficient to judge the six evaluation criteria (requirement coverage, responsibilities, coupling, encapsulation, extensibility, explanation quality). Adding formats later is supported by the `SubmissionContent` interface design, so deferring them is a sensible trade-off for a 2-day prototype.

## 3. Rubric structure and LLM evaluation approach

**What AI suggested:** I asked how to structure feedback so it's useful when multiple valid designs exist. The AI suggested using a fixed rubric with criterion-level evaluation rather than a single "score the design" prompt. It recommended a structured output format: criterion → score → evidence → concern → suggestion → confidence. It also advised separating deterministic checks (rule-based) from judgement-heavy checks (LLM) and using low temperature with JSON schema validation.

**What I accepted:** I accepted the full rubric approach and the separation of rule-based vs LLM evaluation. The mock API implements this with `RuleBasedEvaluator` (structure checks) and `LLMEvaluator` (judgement criteria). The `CANNED_EVALUATION` in the mock follows the exact output shape.

**What I rejected:** The AI suggested using a reference solution as a "hint set" for the LLM to compare against. I rejected this because the assignment explicitly warns against treating a reference solution as the only correct answer. Instead, the rubric judges properties of the design itself (responsibilities, coupling, extensibility) rather than similarity to a reference.

**Why:** A property-based rubric accepts alternative valid designs and provides actionable feedback. The structured output makes it easy to show evidence from the learner's own text, which is more useful than a generic "good design" comment. Separating deterministic and LLM checks keeps costs down and makes failures explainable.

## 4. State machine and reliability design

**What AI suggested:** When I asked how to handle slow or failing AI evaluation, the AI suggested a three-state machine (SUBMITTED → EVALUATING → COMPLETED/FAILED) with idempotency via content hashing. It recommended persisting the submission before evaluation starts, running evaluation in the background, and allowing retry on failure. It also suggested a degraded mode where rule-based results are returned if the LLM fails.

**What I accepted:** I accepted the state machine, persistence-first approach, and idempotency. The mock implements all of this with `SubmissionStatus`, content hash deduplication, and the `forceFail`/`forceDegraded` testing hooks.

**What I rejected:** The AI suggested adding a message queue (e.g., RabbitMQ or SQS) for reliability. I rejected this because the assignment explicitly says "do not turn this into a distributed-systems project" and a simple monolith is acceptable. In-process background work with a startup sweep for stuck jobs is sufficient for the MVP.

**Why:** The state machine makes the evaluation flow explicit and testable. Persisting first prevents data loss on evaluator failure. Idempotency prevents duplicate processing. These are practical reliability concerns that any real implementation needs, even without a full distributed system. Degraded mode keeps the product useful even when AI is flaky.

## 5. Domain model and extensibility design

**What AI suggested:** I asked for a domain model that would pass the two change tests (add diagram format, add human reviewer). The AI suggested interface-based variation points: `SubmissionContent` for formats, `Evaluator` for evaluation approaches, and `LLMClient` for model vendors. It advised against adding interfaces for data-owning classes like `Problem` or `Attempt` unless a second implementation was clearly needed.

**What I accepted:** I accepted the interface-based design at the variation points. The mock's `mockClient.ts` doesn't implement interfaces explicitly (it's a single object), but the design document describes `SubmissionContent`, `Evaluator`, and `LLMClient` as the points of change.

**What I rejected:** The AI suggested adding a factory pattern for creating evaluators and a strategy pattern for rubric selection. I rejected this because the MVP has a single rubric and a fixed evaluator composition. Adding patterns without a clear use case would be over-engineering.

**Why:** The assignment asks to show engineering judgement, not pattern knowledge. Interfaces at the actual variation points make the change tests trivial to pass. Avoiding interfaces elsewhere keeps the model simple. This is the right balance: prepare for change where it's likely, avoid complexity where it isn't.
