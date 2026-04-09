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

export class Ghost {
  private db: GhostDatabase;

  constructor(db: GhostDatabase) {
    this.db = db;
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
    return { response: 'Proceed with your best judgment based on the acceptance criteria.' };
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
