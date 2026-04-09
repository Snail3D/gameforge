import { mkdirSync, appendFileSync } from 'fs';
import { join } from 'path';
import type { GameForgeEvent } from './event-types.js';

type Listener = (event: GameForgeEvent) => void;

export class SessionLogger {
  private readonly filePath: string;
  private listeners: Set<Listener> = new Set();

  constructor(metaDir: string, gameName: string) {
    mkdirSync(metaDir, { recursive: true });
    this.filePath = join(metaDir, `${gameName}-session.jsonl`);
    const header = JSON.stringify({ type: 'session_start', ts: new Date().toISOString(), gameName });
    appendFileSync(this.filePath, header + '\n');
  }

  log(event: GameForgeEvent): void {
    appendFileSync(this.filePath, JSON.stringify(event) + '\n');
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  close(): void {
    const footer = JSON.stringify({ type: 'session_end', ts: new Date().toISOString() });
    appendFileSync(this.filePath, footer + '\n');
    this.listeners.clear();
  }
}
