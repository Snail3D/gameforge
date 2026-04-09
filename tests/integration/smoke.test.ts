import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LLMClient } from '../../src/llm/client.js';
import { SessionLogger } from '../../src/logging/session-logger.js';
import { LoopDetector } from '../../src/supervisor/loop-detector.js';
import { Ghost } from '../../src/supervisor/ghost.js';
import { MiniLoop } from '../../src/supervisor/mini-loop.js';
import { FileTools } from '../../src/tools/file-tools.js';
import { StepFeeder } from '../../src/supervisor/step-feeder.js';
import { Heartbeat } from '../../src/supervisor/heartbeat.js';
import { NarrativeWriter } from '../../src/logging/narrative-writer.js';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const TEST_DIR = join(process.cwd(), 'tests', '_tmp_integration');

describe('Integration Smoke Test', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('should wire all components together', async () => {
    // 1. SessionLogger — create, verify it exists
    const logger = new SessionLogger(TEST_DIR, 'smoke-test-game');
    expect(logger).toBeDefined();
    logger.close();

    // 2. LoopDetector — check('normal code output') returns { looping: false }
    const detector = new LoopDetector();
    const result = detector.check('normal code output');
    expect(result).toEqual({ looping: false });

    // 3. Ghost — answer a question about canvas → should return a response
    const ghost = new Ghost({
      ghostEntries: [
        {
          id: 'canvas-size',
          triggers: ['canvas', 'canvas size'],
          context: 'HTML5 canvas setup',
          response: 'Use a 800x600 canvas for the game viewport.',
          prdReference: 'step-1',
        },
      ],
      knownWeaknesses: [],
    });
    const answer = ghost.answerQuestion('What size should the canvas be?');
    expect(answer.response).toBeTruthy();
    expect(typeof answer.response).toBe('string');

    // 4. MiniLoop — format a step prompt → should contain step title
    const miniLoop = new MiniLoop();
    const step = {
      stepId: 1,
      title: 'Initialize Game Canvas',
      context: 'Set up the HTML5 canvas element',
      task: 'Create the canvas and rendering context',
      filesToCreate: ['index.html'],
      filesToModify: [],
      acceptanceCriteria: ['Canvas is visible', 'Context is initialized'],
      encouragement: "You've got this!",
      maxAttempts: 3,
    };
    const prompt = miniLoop.formatBuilderPrompt(step);
    expect(prompt).toContain('Initialize Game Canvas');

    // 5. FileTools — write a file, read it back, search for content
    const gameDir = join(TEST_DIR, 'game');
    mkdirSync(gameDir, { recursive: true });
    const tools = new FileTools(gameDir);
    tools.writeFile('index.html', '<canvas id="gameCanvas"></canvas>');
    const content = tools.readFile('index.html');
    expect(content).toBe('<canvas id="gameCanvas"></canvas>');
    const searchResults = tools.searchCode('gameCanvas');
    expect(searchResults.length).toBeGreaterThan(0);

    // 6. StepFeeder — create with 2 steps, advance, check progress
    const steps = [
      { ...step, stepId: 1, title: 'Step One' },
      { ...step, stepId: 2, title: 'Step Two' },
    ];
    const feeder = new StepFeeder(steps);
    expect(feeder.currentStep()?.title).toBe('Step One');
    feeder.markCompleted(1, 'passed', [{ attempt: 1 }]);
    feeder.advance();
    expect(feeder.currentStep()?.title).toBe('Step Two');
    const progress = feeder.getProgress();
    expect(progress.completed).toBe(1);
    expect(progress.total).toBe(2);

    // 7. Heartbeat — create with callback, verify start/stop don't throw
    let stallFired = false;
    const heartbeat = new Heartbeat(60000, () => { stallFired = true; });
    expect(() => heartbeat.start(50000)).not.toThrow();
    expect(() => heartbeat.stop()).not.toThrow();
    expect(stallFired).toBe(false);

    // 8. NarrativeWriter — add an event, generate markdown
    const writer = new NarrativeWriter('Smoke Test Game', 'gemma4:moe-chat', 'gpt-oss:120b');
    writer.addEvent({
      type: 'step_assign',
      stepId: 'step-1',
      title: 'Initialize Canvas',
      ts: new Date().toISOString(),
      agent: 'supervisor',
      model: 'gpt-oss:120b',
    });
    const markdown = writer.generate();
    expect(markdown).toContain('Smoke Test Game');
    expect(markdown).toContain('Initialize Canvas');

    // 9. LLMClient — create, verify model property
    const client = new LLMClient({ baseUrl: 'http://localhost:11434', model: 'gemma4:moe-chat' });
    expect(client.model).toBe('gemma4:moe-chat');
  });
});
