import type { StepDefinition } from '../agents/types.js';

export interface StepLogEntry {
  stepId: number;
  status: 'passed' | 'failed' | 'skipped';
  attempts: Array<{ attempt: number; error?: string; criticFeedback?: string }>;
}

export class StepFeeder {
  private steps: StepDefinition[];
  private currentIndex: number = 0;
  private log: StepLogEntry[] = [];

  constructor(steps: StepDefinition[]) {
    this.steps = steps;
  }

  currentStep(): StepDefinition | null {
    if (this.currentIndex >= this.steps.length) return null;
    return this.steps[this.currentIndex];
  }

  advance(): StepDefinition | null {
    this.currentIndex++;
    return this.currentStep();
  }

  markCompleted(stepId: number, status: 'passed' | 'skipped', attempts: StepLogEntry['attempts']): void {
    this.log.push({ stepId, status, attempts });
  }

  getProgress(): { completed: number; skipped: number; total: number; percentage: number } {
    const completed = this.log.filter(e => e.status === 'passed').length;
    const skipped = this.log.filter(e => e.status === 'skipped').length;
    const total = this.steps.length;
    const percentage = total === 0 ? 0 : Math.round(((completed + skipped) / total) * 100);
    return { completed, skipped, total, percentage };
  }

  getLog(): StepLogEntry[] {
    return [...this.log];
  }

  getSkippedSteps(): StepDefinition[] {
    const skippedIds = new Set(
      this.log.filter(e => e.status === 'skipped').map(e => e.stepId),
    );
    return this.steps.filter(s => skippedIds.has(s.stepId));
  }

  hasMoreSteps(): boolean {
    return this.currentIndex < this.steps.length;
  }
}
