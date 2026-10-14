import OpenAI from 'openai'
import type { SubmissionContent, CriterionResult } from '../types.js'
import type { Evaluator } from './evaluator.js'

/** The only slice of the OpenAI SDK we use; lets tests inject a fake. */
export interface ChatClient {
  chat: { completions: { create: (body: any, options?: any) => Promise<any> } }
}

export const LLM_CRITERIA = ['responsibilities', 'coupling', 'tradeoffs', 'extensibility'] as const
const LLM_TIMEOUT_MS = 30_000

export class LLMEvaluator implements Evaluator {
  private client: ChatClient
  private model: string

  constructor(apiKey: string, model = 'gpt-4o-mini', client?: ChatClient) {
    this.client = client ?? (new OpenAI({ apiKey }) as unknown as ChatClient)
    this.model = model
  }

  async evaluate(content: SubmissionContent, problemRequirements: string[]): Promise<CriterionResult[]> {
    const prompt = this.buildPrompt(content, problemRequirements)

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `You are an expert at evaluating Low-Level Design (LLD) solutions. Evaluate the design based on the rubric below. For each criterion, provide a score (0-4), evidence quoted from the learner's text, a concern if the score is low, a suggestion for improvement, and your confidence level.

Score scale:
0 - Missing or completely incorrect
1 - Weak attempt, major issues
2 - Partially correct, some issues
3 - Good, minor issues
4 - Strong, no issues

Respond in JSON format with this exact structure:
{
  "results": [
    {
      "criterionId": "responsibilities",
      "criterion": "Responsibility assignment",
      "score": 3,
      "evidence": "Quote from learner text",
      "concern": "What's wrong if score < 3",
      "suggestion": "How to improve",
      "confidence": "high"
    }
  ],
  "overallScore": 2.8,
  "summary": "One-sentence summary of the design quality"
}`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }, { timeout: LLM_TIMEOUT_MS })

      const data = JSON.parse(response.choices[0].message.content || '{}')
      return this.transformResults(data.results)
    } catch (error) {
      console.error('LLM evaluation failed:', error)
      throw new Error('LLM evaluation failed')
    }
  }

  private buildPrompt(content: SubmissionContent, problemRequirements: string[]): string {
    return `Evaluate this LLD design for the following problem:

Problem requirements:
${problemRequirements.map((r, i) => `${i + 1}. ${r}`).join('\n')}

Learner's design:

Assumptions:
${content.assumptions}

Classes and interfaces:
${content.classes.map(c => `- ${c.name} (${c.kind}): ${c.responsibility}\n  Methods: ${c.keyMethods.join(', ')}`).join('\n')}

Relationships:
${content.relationships}

Key flow:
${content.keyFlow}

Trade-offs and extension points:
${content.tradeoffs}

Evaluate on these criteria:
1. responsibilities - How well are responsibilities assigned? Are classes focused? Is there clear separation of concerns?
2. coupling - How is coupling between classes? Do high-level types depend on low-level details? Are interfaces used appropriately?
3. tradeoffs - Does the design discuss trade-offs? Are the costs of chosen options explained?
4. extensibility - How well would the design handle requirement changes? Are extension points clear?

For each criterion, provide:
- criterionId: exactly one of responsibilities, coupling, tradeoffs, extensibility
- criterion: the same name
- score: 0-4 based on the scale
- evidence: a direct quote from the learner's text that supports your score
- concern: what's wrong if the score is low (empty if score >= 3)
- suggestion: how to improve (can be brief)
- confidence: "high", "medium", or "low"`
  }

  /** Validates untrusted model output: unknown criteria are dropped, scores clamped to 0-4. */
  private transformResults(results: unknown): CriterionResult[] {
    if (!Array.isArray(results)) throw new Error('LLM response had no results array')

    const valid: CriterionResult[] = []
    for (const r of results) {
      if (!r || typeof r !== 'object') continue
      const raw = r as Record<string, unknown>
      const id = String(raw.criterionId ?? '')
      const score = Number(raw.score)
      if (!(LLM_CRITERIA as readonly string[]).includes(id) || !Number.isFinite(score)) continue

      const confidence = ['high', 'medium', 'low'].includes(String(raw.confidence))
        ? (raw.confidence as CriterionResult['confidence'])
        : 'medium'
      valid.push({
        criterionId: id,
        criterion: String(raw.criterion ?? id),
        score: Math.min(4, Math.max(0, score)),
        evidence: String(raw.evidence ?? ''),
        concern: String(raw.concern ?? ''),
        suggestion: String(raw.suggestion ?? ''),
        confidence,
        source: 'llm',
      })
    }

    if (valid.length === 0) throw new Error('LLM response contained no valid criteria')
    return valid
  }
}
