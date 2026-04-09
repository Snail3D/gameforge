export interface LoopDetectorConfig {
  phraseRepeatThreshold?: number;  // min times a phrase repeats to trigger (default: 3)
  phraseMinLength?: number;        // min tokens in phrase to check (default: 5)
  lineRepeatThreshold?: number;    // min times a line repeats (default: 5)
  stagnationThreshold?: number;    // similarity ratio to trigger (default: 0.9)
  maxOutputLength?: number;        // max chars before runaway (default: 10000)
  chunkHistorySize?: number;       // chunks to keep for stagnation check (default: 3)
}

export interface LoopCheckResult {
  looping: boolean;
  reason?: 'token_repeat' | 'line_repeat' | 'runaway' | 'stagnation';
}

export class LoopDetector {
  private phraseRepeatThreshold: number;
  private phraseMinLength: number;
  private lineRepeatThreshold: number;
  private stagnationThreshold: number;
  private maxOutputLength: number;
  private chunkHistorySize: number;
  private chunks: string[];

  constructor(config: LoopDetectorConfig = {}) {
    this.phraseRepeatThreshold = config.phraseRepeatThreshold ?? 3;
    this.phraseMinLength = config.phraseMinLength ?? 5;
    this.lineRepeatThreshold = config.lineRepeatThreshold ?? 5;
    this.stagnationThreshold = config.stagnationThreshold ?? 0.9;
    this.maxOutputLength = config.maxOutputLength ?? 10000;
    this.chunkHistorySize = config.chunkHistorySize ?? 3;
    this.chunks = [];
  }

  checkTokenRepeat(text: string): boolean {
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const n = this.phraseMinLength;
    const counts = new Map<string, number>();

    for (let i = 0; i <= words.length - n; i++) {
      const phrase = words.slice(i, i + n).join(' ');
      const count = (counts.get(phrase) ?? 0) + 1;
      counts.set(phrase, count);
      if (count >= this.phraseRepeatThreshold) {
        return true;
      }
    }
    return false;
  }

  checkLineRepeat(text: string): boolean {
    const lines = text.split('\n');
    const counts = new Map<string, number>();

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length === 0) continue;
      const count = (counts.get(trimmed) ?? 0) + 1;
      counts.set(trimmed, count);
      if (count >= this.lineRepeatThreshold) {
        return true;
      }
    }
    return false;
  }

  addChunk(chunk: string): void {
    this.chunks.push(chunk);
    if (this.chunks.length > this.chunkHistorySize) {
      this.chunks.shift();
    }
  }

  checkStagnation(): boolean {
    if (this.chunks.length < 2) return false;

    for (let i = 0; i < this.chunks.length; i++) {
      for (let j = i + 1; j < this.chunks.length; j++) {
        const similarity = this.jaccardSimilarity(this.chunks[i], this.chunks[j]);
        if (similarity <= this.stagnationThreshold) {
          return false;
        }
      }
    }
    return true;
  }

  private jaccardSimilarity(a: string, b: string): number {
    const setA = new Set(a.split(/\s+/).filter(w => w.length > 0));
    const setB = new Set(b.split(/\s+/).filter(w => w.length > 0));

    let intersection = 0;
    for (const word of setA) {
      if (setB.has(word)) intersection++;
    }

    const union = new Set([...setA, ...setB]).size;
    if (union === 0) return 1;
    return intersection / union;
  }

  checkRunaway(text: string, hasCodeBlocks: boolean): boolean {
    if (hasCodeBlocks) return false;
    return text.length > 2 * this.maxOutputLength;
  }

  check(text: string, hasCodeBlocks = false): LoopCheckResult {
    if (this.checkTokenRepeat(text)) {
      return { looping: true, reason: 'token_repeat' };
    }
    if (this.checkLineRepeat(text)) {
      return { looping: true, reason: 'line_repeat' };
    }
    if (this.checkRunaway(text, hasCodeBlocks)) {
      return { looping: true, reason: 'runaway' };
    }
    if (this.checkStagnation()) {
      return { looping: true, reason: 'stagnation' };
    }
    return { looping: false };
  }

  getRecoveryMessage(attempt: number, stepTitle: string, ghostHint?: string): string {
    switch (attempt) {
      case 1:
        return `Hey, looks like you started repeating yourself there. No worries — happens to the best of us. Grab a coffee and let's try that again. Here's what you were working on: ${stepTitle}`;
      case 2:
        return `Alright, you looped again. Let me help you out. Here's exactly what we need right now for "${stepTitle}". Just focus on that, nothing else. You got this.`;
      case 3:
        return `Fresh start! Here's the task: ${stepTitle}.${ghostHint ? ` And here's a hint: ${ghostHint}` : ''} Take it nice and easy.`;
      default:
        return `We're gonna come back to this one later. Moving on to the next step — you've been crushing it overall, don't sweat this one.`;
    }
  }

  reset(): void {
    this.chunks = [];
  }
}
