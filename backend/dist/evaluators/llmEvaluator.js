import OpenAI from 'openai';
export class LLMEvaluator {
    client;
    model;
    constructor(apiKey, model = 'gpt-4o-mini') {
        this.client = new OpenAI({ apiKey });
        this.model = model;
    }
    async evaluate(content, problemRequirements) {
        const prompt = this.buildPrompt(content, problemRequirements);
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
            });
            const data = JSON.parse(response.choices[0].message.content || '{}');
            return this.transformResults(data.results, data.overallScore, data.summary);
        }
        catch (error) {
            console.error('LLM evaluation failed:', error);
            throw new Error('LLM evaluation failed');
        }
    }
    buildPrompt(content, problemRequirements) {
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
- criterionId: use the criterion name above
- criterion: the same name
- score: 0-4 based on the scale
- evidence: a direct quote from the learner's text that supports your score
- concern: what's wrong if the score is low (empty if score >= 3)
- suggestion: how to improve (can be brief)
- confidence: "high", "medium", or "low"`;
    }
    transformResults(results, overallScore, summary) {
        return results.map(r => ({
            criterionId: r.criterionId,
            criterion: r.criterion,
            score: r.score,
            evidence: r.evidence,
            concern: r.concern || '',
            suggestion: r.suggestion,
            confidence: r.confidence || 'medium',
            source: 'llm',
        }));
    }
}
