import type { GameForgeEvent, AgentName } from './event-types.js';

interface StepNarrative {
  stepId: number;
  title: string;
  status: string;
  attempts: number;
  messages: Array<{ agent: AgentName; model: string; content: string; tokPerSec: number }>;
  ghostEvents: Array<{ trigger: string; response: string }>;
  loopEvents: Array<{ repeatedTokens: string; recoveryAttempt: number }>;
}

interface AgentStats {
  messages: number;
  totalTokPerSec: number;
  totalTokensOut: number;
}

export class NarrativeWriter {
  private gameName: string;
  private builderModel: string;
  private plannerModel: string;
  private steps: Map<string, StepNarrative> = new Map();
  private stepOrder: string[] = [];
  private agentStats: Map<AgentName, AgentStats> = new Map();
  private loopsCaught = 0;
  private ghostInterventions = 0;
  private currentStepId: string | null = null;

  constructor(gameName: string, builderModel: string, plannerModel: string) {
    this.gameName = gameName;
    this.builderModel = builderModel;
    this.plannerModel = plannerModel;
  }

  addEvent(event: GameForgeEvent): void {
    if (event.type === 'step_assign') {
      const id = event.stepId;
      const narrative: StepNarrative = {
        stepId: this.stepOrder.length + 1,
        title: event.title,
        status: 'pending',
        attempts: 0,
        messages: [],
        ghostEvents: [],
        loopEvents: [],
      };
      this.steps.set(id, narrative);
      this.stepOrder.push(id);
      this.currentStepId = id;
    } else if (event.type === 'step_update') {
      const step = this.steps.get(event.stepId);
      if (step) {
        step.status = event.status;
        step.attempts = event.attempt;
      }
    } else if (event.type === 'message') {
      const step = this.currentStepId ? this.steps.get(this.currentStepId) : null;
      if (step) {
        step.messages.push({
          agent: event.agent,
          model: event.model,
          content: event.content,
          tokPerSec: event.tokPerSec,
        });
      }
      const stats = this.agentStats.get(event.agent) ?? { messages: 0, totalTokPerSec: 0, totalTokensOut: 0 };
      stats.messages += 1;
      stats.totalTokPerSec += event.tokPerSec;
      stats.totalTokensOut += event.tokensOut;
      this.agentStats.set(event.agent, stats);
    } else if (event.type === 'ghost_intervention') {
      this.ghostInterventions += 1;
      const step = this.currentStepId ? this.steps.get(this.currentStepId) : null;
      if (step) {
        step.ghostEvents.push({ trigger: event.trigger, response: event.response });
      }
    } else if (event.type === 'loop_detected') {
      this.loopsCaught += 1;
      const step = this.currentStepId ? this.steps.get(this.currentStepId) : null;
      if (step) {
        step.loopEvents.push({ repeatedTokens: event.repeatedTokens, recoveryAttempt: event.recoveryAttempt });
      }
    }
  }

  generate(): string {
    const lines: string[] = [];

    lines.push(`# GameForge Session: ${this.gameName}`);
    lines.push(`**Models:** ${this.plannerModel} (planner), ${this.builderModel} (builder/reviewer/critic)`);
    lines.push('');

    // Summary
    const total = this.stepOrder.length;
    const completed = [...this.steps.values()].filter(s => s.status === 'passed').length;
    const skipped = [...this.steps.values()].filter(s => s.status === 'skipped').length;

    lines.push('## Summary');
    lines.push(`- ${total} steps planned, ${completed} completed, ${skipped} skipped`);
    lines.push(`- ${this.loopsCaught} loops caught, ${this.ghostInterventions} Ghost interventions`);
    lines.push('');

    // Step-by-step narrative
    lines.push('## Step-by-Step Narrative');
    for (const id of this.stepOrder) {
      const step = this.steps.get(id)!;
      lines.push(`### Step ${step.stepId}: ${step.title} (${step.status}, ${step.attempts} attempts)`);

      for (const msg of step.messages) {
        const truncated = msg.content.length > 200 ? msg.content.slice(0, 200) + '...' : msg.content;
        lines.push(`**${msg.agent}** (${msg.model}): ${truncated}`);
      }

      for (const ghost of step.ghostEvents) {
        const truncated = ghost.response.length > 150 ? ghost.response.slice(0, 150) + '...' : ghost.response;
        lines.push(`*Ghost [${ghost.trigger}]:* ${truncated}`);
      }

      for (const loop of step.loopEvents) {
        const truncated = loop.repeatedTokens.length > 80 ? loop.repeatedTokens.slice(0, 80) + '...' : loop.repeatedTokens;
        lines.push(`*Loop caught:* "${truncated}..." (attempt ${loop.recoveryAttempt})`);
      }

      lines.push('');
    }

    // Agent performance stats
    lines.push('## Agent Performance Stats');
    lines.push('| Agent | Messages | Avg tok/s |');
    lines.push('|-------|----------|-----------|');
    for (const [agent, stats] of this.agentStats.entries()) {
      const avg = stats.messages > 0 ? (stats.totalTokPerSec / stats.messages).toFixed(1) : '0.0';
      lines.push(`| ${agent} | ${stats.messages} | ${avg} |`);
    }

    return lines.join('\n');
  }
}
