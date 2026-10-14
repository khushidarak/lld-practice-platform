import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { LLMEvaluator, type ChatClient } from '../evaluators/llmEvaluator.js'
import { goodDesign, REQUIREMENTS } from './fixtures.js'

function clientReturning(content: string | null): ChatClient {
  return { chat: { completions: { create: vi.fn().mockResolvedValue({ choices: [{ message: { content } }] }) } } }
}
const json = (results: unknown) => JSON.stringify({ results })

describe('LLMEvaluator', () => {
  beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}) })
  afterEach(() => vi.restoreAllMocks())

  it('maps a valid model response to llm-sourced criterion results', async () => {
    const client = clientReturning(json([
      { criterionId: 'coupling', criterion: 'Coupling', score: 3, evidence: 'q', concern: '', suggestion: 's', confidence: 'high' },
    ]))
    const out = await new LLMEvaluator('k', 'm', client).evaluate(goodDesign(), REQUIREMENTS)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ criterionId: 'coupling', score: 3, source: 'llm', confidence: 'high' })
  })

  it('sends a low temperature, JSON mode, and a timeout', async () => {
    const client = clientReturning(json([{ criterionId: 'coupling', score: 2 }]))
    await new LLMEvaluator('k', 'm', client).evaluate(goodDesign(), REQUIREMENTS)
    const [body, options] = (client.chat.completions.create as any).mock.calls[0]
    expect(body.temperature).toBeLessThanOrEqual(0.3)
    expect(body.response_format).toEqual({ type: 'json_object' })
    expect(options.timeout).toBe(30_000)
  })

  it('clamps out-of-range scores into 0-4', async () => {
    const client = clientReturning(json([
      { criterionId: 'coupling', score: 9 },
      { criterionId: 'tradeoffs', score: -2 },
    ]))
    const out = await new LLMEvaluator('k', 'm', client).evaluate(goodDesign(), REQUIREMENTS)
    expect(out.map(r => r.score)).toEqual([4, 0])
  })

  it('drops unknown criteria and entries with non-numeric scores', async () => {
    const client = clientReturning(json([
      { criterionId: 'made-up', score: 3 },
      { criterionId: 'coupling', score: 'high' },
      { criterionId: 'extensibility', score: 2 },
    ]))
    const out = await new LLMEvaluator('k', 'm', client).evaluate(goodDesign(), REQUIREMENTS)
    expect(out.map(r => r.criterionId)).toEqual(['extensibility'])
  })

  it('defaults a missing confidence to medium', async () => {
    const client = clientReturning(json([{ criterionId: 'coupling', score: 2 }]))
    const out = await new LLMEvaluator('k', 'm', client).evaluate(goodDesign(), REQUIREMENTS)
    expect(out[0].confidence).toBe('medium')
  })

  it('throws on malformed (non-JSON) output', async () => {
    await expect(new LLMEvaluator('k', 'm', clientReturning('not json')).evaluate(goodDesign(), REQUIREMENTS)).rejects.toThrow()
  })

  it('throws when the results array is missing', async () => {
    await expect(new LLMEvaluator('k', 'm', clientReturning('{}')).evaluate(goodDesign(), REQUIREMENTS)).rejects.toThrow()
  })

  it('throws when the model returns an empty body', async () => {
    await expect(new LLMEvaluator('k', 'm', clientReturning(null)).evaluate(goodDesign(), REQUIREMENTS)).rejects.toThrow()
  })

  it('throws when no result is valid', async () => {
    const client = clientReturning(json([{ criterionId: 'nope', score: 3 }]))
    await expect(new LLMEvaluator('k', 'm', client).evaluate(goodDesign(), REQUIREMENTS)).rejects.toThrow()
  })

  it('throws "LLM evaluation failed" when the API call rejects (timeout / network)', async () => {
    const client: ChatClient = { chat: { completions: { create: vi.fn().mockRejectedValue(new Error('timeout')) } } }
    await expect(new LLMEvaluator('k', 'm', client).evaluate(goodDesign(), REQUIREMENTS)).rejects.toThrow('LLM evaluation failed')
  })
})
