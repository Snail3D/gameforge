import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { SessionLogger } from '../../src/logging/session-logger.js';
import type { GameForgeEvent } from '../../src/logging/event-types.js';

const sampleEvent: GameForgeEvent = {
  type: 'message',
  ts: new Date().toISOString(),
  agent: 'builder',
  model: 'gemma4:moe-chat',
  content: 'Hello world',
  tokensIn: 10,
  tokensOut: 20,
  tokPerSec: 30,
};

describe('SessionLogger', () => {
  let tmpDir: string;
  let logger: SessionLogger;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'gameforge-test-'));
    logger = new SessionLogger(tmpDir, 'test-game');
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates session log file with session_start header on construction', () => {
    const filePath = join(tmpDir, 'test-game-session.jsonl');
    const content = readFileSync(filePath, 'utf8');
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(1);
    const header = JSON.parse(lines[0]);
    expect(header.type).toBe('session_start');
    expect(header.gameName).toBe('test-game');
    expect(typeof header.ts).toBe('string');
  });

  it('log() appends events as JSONL lines', () => {
    logger.log(sampleEvent);
    logger.log({ ...sampleEvent, content: 'Second message' });

    const filePath = join(tmpDir, 'test-game-session.jsonl');
    const content = readFileSync(filePath, 'utf8');
    const lines = content.trim().split('\n');

    // header + 2 events
    expect(lines).toHaveLength(3);
    const first = JSON.parse(lines[1]);
    expect(first.type).toBe('message');
    expect(first.content).toBe('Hello world');
    const second = JSON.parse(lines[2]);
    expect(second.content).toBe('Second message');
  });

  it('subscribe() notifies listeners when events are logged', () => {
    const received: GameForgeEvent[] = [];
    logger.subscribe((event) => received.push(event));

    logger.log(sampleEvent);
    logger.log({ ...sampleEvent, content: 'Another' });

    expect(received).toHaveLength(2);
    expect(received[0].type).toBe('message');
    expect((received[1] as typeof sampleEvent).content).toBe('Another');
  });

  it('subscribe() returns an unsubscribe function that stops notifications', () => {
    const received: GameForgeEvent[] = [];
    const unsubscribe = logger.subscribe((event) => received.push(event));

    logger.log(sampleEvent);
    unsubscribe();
    logger.log(sampleEvent);

    expect(received).toHaveLength(1);
  });

  it('close() writes session_end line and clears listeners', () => {
    const received: GameForgeEvent[] = [];
    logger.subscribe((event) => received.push(event));
    logger.log(sampleEvent);
    logger.close();

    // session_end must be the last line after close
    const filePath = join(tmpDir, 'test-game-session.jsonl');
    const content = readFileSync(filePath, 'utf8');
    const lines = content.trim().split('\n');
    const footer = JSON.parse(lines[lines.length - 1]);
    expect(footer.type).toBe('session_end');

    // listeners cleared — a new logger using same path would not affect received
    expect(received).toHaveLength(1);
  });
});
