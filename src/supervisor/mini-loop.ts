import type { StepDefinition } from '../agents/types.js';

export interface CriticVerdict {
  passed: boolean;
  reason: string;
  feedback: string;
  featureUpdates: string[];
}

export class MiniLoop {
  formatBuilderPrompt(step: StepDefinition, criticFeedback?: string): string {
    const sections: string[] = [];

    if (criticFeedback) {
      sections.push(`## Previous Feedback\n\n${criticFeedback}`);
    }

    sections.push(`## Current Step: ${step.title}`);
    sections.push(step.encouragement);
    sections.push(`### Context\n\n${step.context}`);
    sections.push(`### Task\n\n${step.task}`);

    if (step.filesToCreate.length > 0) {
      sections.push(`### Files to Create\n\n${step.filesToCreate.map(f => `- ${f}`).join('\n')}`);
    }

    if (step.filesToModify.length > 0) {
      sections.push(`### Files to Modify\n\n${step.filesToModify.map(f => `- ${f}`).join('\n')}`);
    }

    const criteriaList = step.acceptanceCriteria.map(c => `- [ ] ${c}`).join('\n');
    sections.push(`### Acceptance Criteria\n\n${criteriaList}`);

    return sections.join('\n\n');
  }

  parseCriticVerdict(response: string): CriticVerdict {
    // Strip <think>...</think> blocks
    const cleaned = response.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    const verdictMatch = /VERDICT:\s*(PASS|FAIL)/i.exec(cleaned);
    const reasonMatch = /REASON:\s*(.+)/i.exec(cleaned);
    const featureMatch = /FEATURE_UPDATES:\s*(.+)/i.exec(response);

    const passed = verdictMatch ? verdictMatch[1].toUpperCase() === 'PASS' : false;
    const reason = reasonMatch ? reasonMatch[1].trim() : '';

    const featureRaw = featureMatch ? featureMatch[1].trim() : '';
    const featureUpdates = featureRaw
      ? featureRaw.split(',').map(s => s.trim()).filter(s => s.length > 0)
      : [];

    return { passed, reason, feedback: response, featureUpdates };
  }

  parseReviewerVerdict(response: string): { passed: boolean; hasFixedCode: boolean } {
    // Strip everything that isn't the verdict
    let cleaned = response.replace(/<think>[\s\S]*?<\/think>/gi, '');
    cleaned = cleaned.replace(/```\w*\n?/g, '');
    cleaned = cleaned.replace(/\*\*/g, '');  // strip bold markers
    cleaned = cleaned.trim();

    // Simple: does it contain PASS and not FAIL?
    const hasPass = /\bpass\b/i.test(cleaned);
    const hasFail = /\bfail\b/i.test(cleaned);
    const hasFixedCode = /with.?fix/i.test(cleaned);

    if (hasFail && !hasPass) return { passed: false, hasFixedCode: false };
    if (hasPass) return { passed: true, hasFixedCode };

    // No clear verdict — default to pass if no fail mentioned
    return { passed: !hasFail, hasFixedCode: false };
  }
}
