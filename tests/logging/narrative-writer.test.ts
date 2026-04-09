import { describe, it, expect } from 'vitest';
import { NarrativeWriter } from '../../src/logging/narrative-writer.js';
import type { GameForgeEvent } from '../../src/logging/event-types.js';

describe('NarrativeWriter', () => {
  it('generates markdown containing game name, step titles, verdicts, and model names', () => {
    const writer = new NarrativeWriter('SnakeGame', 'llama3.2', 'qwen2.5');

    const events: GameForgeEvent[] = [
      {
        type: 'step_assign',
        ts: '2024-01-01T00:00:00Z',
        agent: 'planner',
        model: 'qwen2.5',
        stepId: '1',
        title: 'Implement player movement',
      },
      {
        type: 'message',
        ts: '2024-01-01T00:01:00Z',
        agent: 'builder',
        model: 'llama3.2',
        content: 'Adding WASD controls to the player character.',
        tokensIn: 100,
        tokensOut: 50,
        tokPerSec: 25.5,
      },
      {
        type: 'message',
        ts: '2024-01-01T00:02:00Z',
        agent: 'critic',
        model: 'llama3.2',
        content: 'PASSED - Movement implementation looks correct and handles edge cases well.',
        tokensIn: 80,
        tokensOut: 40,
        tokPerSec: 30.0,
      },
      {
        type: 'step_update',
        ts: '2024-01-01T00:03:00Z',
        agent: 'supervisor',
        model: 'qwen2.5',
        stepId: '1',
        status: 'passed',
        attempt: 1,
      },
    ];

    for (const event of events) {
      writer.addEvent(event);
    }

    const markdown = writer.generate();

    expect(markdown).toContain('SnakeGame');
    expect(markdown).toContain('Implement player movement');
    expect(markdown).toContain('passed');
    expect(markdown).toContain('llama3.2');
    expect(markdown).toContain('qwen2.5');
  });
});
