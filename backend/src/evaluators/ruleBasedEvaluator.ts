import type { SubmissionContent, CriterionResult } from '../types.js'
import type { Evaluator } from './evaluator.js'

export class RuleBasedEvaluator implements Evaluator {
  evaluate(content: SubmissionContent, problemRequirements: string[]): CriterionResult[] {
    const results: CriterionResult[] = []

    // Check 1: Required sections present
    results.push({
      criterionId: 'sections-present',
      criterion: 'Required sections present',
      score: this.checkSectionsPresent(content),
      evidence: this.getSectionsEvidence(content),
      concern: '',
      suggestion: 'Keep this structure on the next attempt so judgement criteria have enough evidence.',
      confidence: 'high',
      source: 'rule',
    })

    // Check 2: Minimum number of classes
    results.push({
      criterionId: 'minimum-classes',
      criterion: 'Minimum number of classes',
      score: this.checkMinimumClasses(content),
      evidence: `The design includes ${content.classes.length} class(es) or interface(s).`,
      concern: content.classes.length < 2 ? 'A single class suggests the design may not separate concerns well.' : '',
      suggestion: content.classes.length < 2 ? 'Consider whether responsibilities can be split across multiple types.' : '',
      confidence: 'high',
      source: 'rule',
    })

    // Check 3: Requirement coverage (heuristic keyword matching)
    const coverageResult = this.checkRequirementCoverage(content, problemRequirements)
    results.push({
      criterionId: 'requirement-coverage',
      criterion: 'Requirement coverage',
      score: coverageResult.score,
      evidence: coverageResult.evidence,
      concern: coverageResult.concern,
      suggestion: coverageResult.suggestion,
      confidence: 'low',
      source: 'rule',
    })

    // Check 4: Each class has responsibility and methods
    results.push({
      criterionId: 'class-completeness',
      criterion: 'Class completeness',
      score: this.checkClassCompleteness(content),
      evidence: this.getClassCompletenessEvidence(content),
      concern: '',
      suggestion: 'Each class should have a clear responsibility and at least one key method.',
      confidence: 'high',
      source: 'rule',
    })

    return results
  }

  private checkSectionsPresent(content: SubmissionContent): number {
    const hasAssumptions = content.assumptions.trim().length > 0
    const hasRelationships = content.relationships.trim().length > 0
    const hasKeyFlow = content.keyFlow.trim().length > 0
    const hasTradeoffs = content.tradeoffs.trim().length > 0
    const hasClasses = content.classes.length > 0

    const present = [hasAssumptions, hasRelationships, hasKeyFlow, hasTradeoffs, hasClasses].filter(Boolean).length
    return (present / 5) * 4
  }

  private getSectionsEvidence(content: SubmissionContent): string {
    const sections: string[] = []
    if (content.assumptions.trim()) sections.push('assumptions')
    if (content.relationships.trim()) sections.push('relationships')
    if (content.keyFlow.trim()) sections.push('key flow')
    if (content.tradeoffs.trim()) sections.push('trade-offs')
    if (content.classes.length > 0) sections.push('classes')
    return `Filled sections: ${sections.join(', ')}.`
  }

  private checkMinimumClasses(content: SubmissionContent): number {
    if (content.classes.length === 0) return 0
    if (content.classes.length === 1) return 2
    if (content.classes.length >= 2 && content.classes.length <= 4) return 4
    return 3 // Too many classes might indicate over-engineering
  }

  private checkRequirementCoverage(content: SubmissionContent, requirements: string[]): {
    score: number
    evidence: string
    concern: string
    suggestion: string
  } {
    const contentText = `${content.assumptions} ${content.keyFlow} ${content.classes.map(c => c.responsibility).join(' ')}`.toLowerCase()
    let covered = 0

    const missingKeywords: string[] = []
    for (const req of requirements) {
      const keywords = this.extractKeywords(req)
      const hasKeyword = keywords.some(kw => contentText.includes(kw.toLowerCase()))
      if (hasKeyword) covered++
      else missingKeywords.push(keywords[0])
    }

    if (requirements.length === 0) {
      return { score: 4, evidence: 'The problem lists no requirements to check.', concern: '', suggestion: '' }
    }

    const score = (covered / requirements.length) * 4
    return {
      score,
      evidence: `${covered} of ${requirements.length} requirements appear to be addressed by keyword matching.`,
      concern: covered < requirements.length ? `Some requirements may be missing: ${missingKeywords.slice(0, 2).join(', ')}.` : '',
      suggestion: covered < requirements.length ? 'Echo each requirement in assumptions or the flow so coverage is obvious.' : '',
    }
  }

  private extractKeywords(requirement: string): string[] {
    // Simple keyword extraction: take nouns and verbs
    const words = requirement.toLowerCase().split(/\s+/)
    return words.filter(w => w.length > 3 && !['the', 'and', 'for', 'with', 'from', 'that'].includes(w))
  }

  private checkClassCompleteness(content: SubmissionContent): number {
    if (content.classes.length === 0) return 0

    let complete = 0
    for (const cls of content.classes) {
      const hasName = cls.name.trim().length > 0
      const hasResponsibility = cls.responsibility.trim().length > 0
      const hasMethods = cls.keyMethods.length > 0
      if (hasName && hasResponsibility && hasMethods) complete++
    }

    return (complete / content.classes.length) * 4
  }

  private getClassCompletenessEvidence(content: SubmissionContent): string {
    const complete = content.classes.filter(c => c.name && c.responsibility && c.keyMethods.length > 0).length
    return `${complete} of ${content.classes.length} classes have name, responsibility, and methods.`
  }
}
