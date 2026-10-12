# Research Note: LLD Practice Platform

## 1. The learner problem

Low-Level Design (LLD) is easy to start and hard to evaluate. A learner can sketch a Parking Lot or Elevator in twenty minutes and still have no idea whether the design is good. Three things make this hard:

1. **No single right answer.** Two valid designs can look very different, so "compare to the reference solution" misleads. A learner who diverges from the reference is told they are wrong when they may not be.
2. **No feedback loop.** Most self-study is reading a solution and nodding along. Writing your own design and getting it critiqued is the part that actually teaches, and it needs a reviewer, which is rare and slow.
3. **No memory across attempts.** Learners repeat the same mistakes (god classes, leaking internals, `if/else` chains instead of polymorphism) because nothing shows them the pattern in their own work.

Learners also practise the wrong skill. Interviews and real work test *evolving* a design when a requirement changes, but most practice stops at the first working design.

## 2. What exists today

I reviewed the public pages of the tools below. I did not use paid tiers, so claims describe what each product states publicly.

| Tool / approach | Format | Feedback | Observations |
|---|---|---|---|
| **AlgoMaster LLD Practice** | Timed, AI-led mock interview in four stages: clarify requirements, class design, explain patterns, implement and run code | AI score and feedback on design and code quality; sessions saved with score and feedback in a history | Closest to this assignment. Heavy: 30-60 minute sessions, code in a chosen language. |
| **Hello Interview Guided Practice** | Step-by-step guided problems for LLD, plus System Design and others | Instant AI feedback | Guided steps keep learners structured. Small problem set; paid. |
| **Educative / Grokking the LLD Interview** | Course: OOD principles, patterns, UML (use case, class, sequence, activity), worked problems | Mostly reading plus mock interview option | Strong teaching content. A learner's own design is not reviewed per attempt. |
| **LowLevelDesign Mastery** (community project) | Browser playground in several languages, diagrams, flashcards | Instant feedback on correctness and complexity | Correctness is checkable for code, but design quality is a different question. |
| **Blogs / community advice** (dev.to, AlgoMaster blog, Educative blog) | Self-directed: problem, then class diagram, then code; keep a design journal | None; the learner judges themselves | Advice stresses clarifying requirements first, expecting several valid designs, and adapting the design to changed requirements. |

For the evaluation side I also read about **LLM-as-a-judge** practice. The consistent advice: use an explicit rubric with a small anchored scale, require structured (JSON) output, make the judge cite evidence, use low temperature, and calibrate against human judgement. Known weaknesses include sensitivity to rubric wording, verbosity and position bias, and the fact that a judge with a weak rubric just measures consistency, not quality.

## 3. Gaps

- **Tools lean on code and long sessions.** A learner who wants a quick 20-minute rep on responsibilities and relationships has to commit to a full implementation.
- **Feedback is often a score.** A number does not say *which line of the design* caused it or what to change.
- **Alternative valid designs are poorly handled.** Rubric-based evaluation is the better fit, but products rarely expose the rubric to the learner.
- **Weak support for the "requirements change" skill.** Retrying with a twist on the same problem is rare.
- **Cross-attempt learning is thin.** History exists (AlgoMaster saves past sessions), but I found no clear evidence of surfacing *recurring weak criteria* over time.

## 4. Product direction

A **lightweight, rubric-first practice loop**:

> Choose problem, write design, submit, get criterion-by-criterion feedback, review, retry (with a change request)

Key choices:

- **Submission format: structured text design** (classes, responsibilities, relationships, key behaviours, trade-offs). It is the smallest format that still shows design reasoning, and it avoids needing a code runner. Diagram and code formats can be added later behind the same interface.
- **Rubric, not reference solution.** Each attempt is scored on fixed criteria (requirement coverage, responsibilities, coupling/cohesion, encapsulation, extensibility, edge cases, explanation quality). Several different designs can score well.
- **Evidence-linked feedback.** Every criterion returns score, evidence quoted from the learner's text, concern, suggestion, and confidence.
- **Deterministic checks first, LLM second.** Structure and completeness are rule-checked; judgement-heavy criteria go to the LLM with a fixed rubric and JSON output.
- **Change request on retry.** Each problem ships a follow-up requirement ("add EV charging spots") so the second attempt practises extensibility.
- **History with recurring weaknesses.** Show per-criterion trend across attempts so the learner sees what they keep missing.

## 5. Sources

- AlgoMaster, Low Level Design Practice: https://algomaster.io/interview/low-level-design
- AlgoMaster, How to Learn Low-Level Design: https://algomaster.io/learn/lld/how-to-learn-lld
- Hello Interview, Guided Practice: https://hellointerview.com/practice/y
- Educative, Grokking the Low Level Design Interview: https://www.devpath.com/collection/5668639101419520/5692201761767424
- Educative blog, preparing for LLD questions: https://www.educative.io/blog/how-to-prepare-for-low-level-design-questions-in-tech-interviews
- LowLevelDesign Mastery (Peerlist): https://peerlist.io/vdsanku/project/lowleveldesign-mastery
- Peerlist article on why engineers struggle with LLD: https://peerlist.io/vdsanku/articles/why-most-engineers-struggle-with-lowlevel-design-interviews-
- DEV Community, preparing for low-level design: https://dev.to/muhammad_salem/how-do-i-prepare-for-low-level-system-design-114g
- LLM-as-a-judge overviews: https://www.digitalocean.com/resources/articles/llm-as-a-judge, https://decagon.ai/glossary/what-is-llm-as-a-judge, https://www.mercor.com/resources/apex/what-is-llm-as-a-judge/
