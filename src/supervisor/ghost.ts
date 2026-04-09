export interface GhostEntry {
  id: string;
  triggers: string[];
  context: string;
  response: string;
  prdReference: string;
}

export interface KnownWeakness {
  id: string;
  description: string;
  detection: string;
  prevention: string;
}

export interface GhostDatabase {
  ghostEntries: GhostEntry[];
  knownWeaknesses: KnownWeakness[];
}

export interface GhostAnswer {
  response: string;
  entryId?: string;
}

export interface WeaknessMatch {
  id: string;
  prevention: string;
}

export interface SmartGhostConfig {
  baseUrl: string;
  model: string;  // e.g. 'gemma4:e4b'
  gameDesign: string;  // the full PRD
}

export class Ghost {
  private db: GhostDatabase;
  private smartConfig: SmartGhostConfig | null = null;

  constructor(db: GhostDatabase, smartConfig?: SmartGhostConfig) {
    this.db = db;
    this.smartConfig = smartConfig || null;
  }

  isQuestion(text: string): boolean {
    return (
      /should I/i.test(text) ||
      /how (do|should|can|would) I/i.test(text) ||
      /which.*\?/i.test(text) ||
      /what (format|type|kind|size|color)/i.test(text) ||
      /do I need/i.test(text) ||
      /is it better/i.test(text) ||
      /\?$/m.test(text)
    );
  }

  answerQuestion(question: string): GhostAnswer {
    const lower = question.toLowerCase();
    for (const entry of this.db.ghostEntries) {
      for (const trigger of entry.triggers) {
        if (lower.includes(trigger.toLowerCase())) {
          return { response: entry.response, entryId: entry.id };
        }
      }
    }
    // No match in lookup table — will need smart fallback
    return { response: '', entryId: undefined, needsSmart: true } as GhostAnswer;
  }

  async answerQuestionSmart(question: string, stepContext: string): Promise<GhostAnswer> {
    // Fast path: try lookup table first
    const fast = this.answerQuestion(question);
    if (!(fast as any).needsSmart) return fast;

    // Smart path: use E4B to answer from PRD context
    if (!this.smartConfig) {
      return { response: 'Proceed with your best judgment based on the acceptance criteria.' };
    }

    try {
      const res = await fetch(`${this.smartConfig.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.smartConfig.model,
          messages: [
            {
              role: 'system',
              content: `You are a helpful assistant answering questions from a game developer. You know the game design document inside and out. Answer concisely and specifically — no filler, just the answer they need to keep coding.

Game Design:
${this.smartConfig.gameDesign.substring(0, 4000)}`,
            },
            {
              role: 'user',
              content: `I'm working on: ${stepContext}\n\nMy question: ${question}`,
            },
          ],
          stream: false,
        }),
      });

      if (!res.ok) {
        return { response: 'Proceed with your best judgment based on the acceptance criteria.' };
      }

      const data = await res.json() as any;
      const answer = data.choices?.[0]?.message?.content || '';
      return { response: answer, entryId: 'smart-ghost' };
    } catch {
      return { response: 'Proceed with your best judgment based on the acceptance criteria.' };
    }
  }

  checkWeakness(output: string): WeaknessMatch | null {
    for (const weakness of this.db.knownWeaknesses) {
      if (weakness.detection === 'step_reference_beyond_current') continue;
      if (output.includes(weakness.detection)) {
        return { id: weakness.id, prevention: weakness.prevention };
      }
    }
    return null;
  }

  checkScopeCreep(output: string, currentStepId: number, totalSteps: number): WeaknessMatch | null {
    const scopeWeakness = this.db.knownWeaknesses.find(w => w.detection === 'step_reference_beyond_current');
    if (!scopeWeakness) return null;

    const stepPattern = /step\s+(\d+)/gi;
    let match: RegExpExecArray | null;
    while ((match = stepPattern.exec(output)) !== null) {
      const referenced = parseInt(match[1], 10);
      if (referenced > currentStepId && referenced <= totalSteps) {
        return { id: scopeWeakness.id, prevention: scopeWeakness.prevention };
      }
    }
    return null;
  }

  getStallMessage(stepTitle: string, criteria: string): string {
    const bullets = criteria
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => `- ${line}`)
      .join('\n');
    return `Hey, just checking in. For this step you need:\n${bullets}\nYou're doing great, keep going.`;
  }

  updateDatabase(db: GhostDatabase): void {
    this.db = db;
  }
}
