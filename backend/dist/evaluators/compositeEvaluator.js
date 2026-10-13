import { RuleBasedEvaluator } from './ruleBasedEvaluator.js';
export class CompositeEvaluator {
    ruleEvaluator;
    llmEvaluator;
    constructor(llmEvaluator) {
        this.ruleEvaluator = new RuleBasedEvaluator();
        this.llmEvaluator = llmEvaluator;
    }
    async evaluate(content, problemRequirements) {
        const ruleResults = this.ruleEvaluator.evaluate(content, problemRequirements);
        if (!this.llmEvaluator) {
            // If no LLM, return only rule results and mark as degraded
            return ruleResults;
        }
        try {
            const llmResults = await this.llmEvaluator.evaluate(content, problemRequirements);
            return this.mergeResults(ruleResults, llmResults);
        }
        catch (error) {
            console.error('LLM evaluation failed, using rule results only:', error);
            return ruleResults;
        }
    }
    mergeResults(ruleResults, llmResults) {
        const merged = new Map();
        // Rule results take precedence for criteria they own
        for (const result of ruleResults) {
            merged.set(result.criterionId, result);
        }
        // Add LLM results for criteria not covered by rules
        for (const result of llmResults) {
            if (!merged.has(result.criterionId)) {
                merged.set(result.criterionId, result);
            }
        }
        return Array.from(merged.values());
    }
}
