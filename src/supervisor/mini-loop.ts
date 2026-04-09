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
    const verdictMatch = /VERDICT:\s*(PASS|FAIL)/i.exec(response);
    const reasonMatch = /REASON:\s*(.+)/i.exec(response);
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
    const trimmed = response.trimStart().toLowerCase();
    if (trimmed.startsWith('pass_with_fixes') || trimmed.startsWith('pass with fixes')) {
      return { passed: true, hasFixedCode: true };
    }
    return { passed: trimmed.startsWith('pass'), hasFixedCode: false };
  }
}
