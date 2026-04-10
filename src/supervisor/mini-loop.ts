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
    // Strip <think>...</think> blocks, markdown fences, and whitespace
    let stripped = response.replace(/<think>[\s\S]*?<\/think>/gi, '');
    stripped = stripped.replace(/```\w*\n?/g, '').trim();
    const lower = stripped.toLowerCase();
    if (lower.startsWith('pass_with_fixes') || lower.startsWith('pass with fixes')) {
      return { passed: true, hasFixedCode: true };
    }
    // Also check for **PASS** markdown bold and PASS: patterns
    if (lower.startsWith('pass') || lower.startsWith('**pass')) {
      return { passed: lower.includes('with_fixes') || lower.includes('with fixes'), hasFixedCode: lower.includes('with_fixes') || lower.includes('with fixes') };
    }
    // Search deeper — MiniMax might put PASS after reasoning
    if (/\bpass\b/i.test(stripped.substring(0, 200)) && !/\bfail\b/i.test(stripped.substring(0, 200))) {
      return { passed: true, hasFixedCode: false };
    }
    return { passed: false, hasFixedCode: false };
  }
}
