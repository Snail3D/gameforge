import { describe, it, expect } from 'vitest';
import { MiniLoop } from '../../src/supervisor/mini-loop.js';
import type { StepDefinition } from '../../src/agents/types.js';

const mockStep: StepDefinition = {
  stepId: 1,
  title: 'Create canvas and render loop',
  context: 'Starting a new game from scratch.',
  task: 'Create index.html with a canvas element and core/engine.js with a requestAnimationFrame render loop.',
  filesToModify: [],
  filesToCreate: ['index.html', 'core/engine.js'],
  acceptanceCriteria: ['Canvas element exists', 'Render loop runs at 60fps', 'No console errors'],
  encouragement: 'This is the foundation — you got this!',
  maxAttempts: 3,
};

describe('MiniLoop', () => {
  const miniLoop = new MiniLoop();

  it('formatBuilderPrompt includes step title, encouragement, file paths, and criteria', () => {
    const prompt = miniLoop.formatBuilderPrompt(mockStep);
    expect(prompt).toContain('Create canvas and render loop');
    expect(prompt).toContain('This is the foundation — you got this!');
    expect(prompt).toContain('index.html');
    expect(prompt).toContain('core/engine.js');
    expect(prompt).toContain('Canvas element exists');
    expect(prompt).toContain('Render loop runs at 60fps');
    expect(prompt).toContain('No console errors');
  });

  it('formatBuilderPrompt with critic feedback includes a Previous Feedback section', () => {
    const feedback = 'The canvas is missing a width attribute.';
    const prompt = miniLoop.formatBuilderPrompt(mockStep, feedback);
    expect(prompt).toContain('Previous Feedback');
    expect(prompt).toContain('The canvas is missing a width attribute.');
    expect(prompt).toContain('Create canvas and render loop');
  });

  it('parseCriticVerdict returns passed:true for PASS response', () => {
    const response = `VERDICT: PASS\nREASON: All acceptance criteria are met.\nFEATURE_UPDATES: canvas-render, engine-init`;
    const verdict = miniLoop.parseCriticVerdict(response);
    expect(verdict.passed).toBe(true);
    expect(verdict.reason).toBe('All acceptance criteria are met.');
    expect(verdict.feedback).toBe(response);
    expect(verdict.featureUpdates).toContain('canvas-render');
    expect(verdict.featureUpdates).toContain('engine-init');
  });

  it('parseCriticVerdict returns passed:false with reason for FAIL response', () => {
    const response = `VERDICT: FAIL\nREASON: Canvas width attribute is missing.\nFEATURE_UPDATES:`;
    const verdict = miniLoop.parseCriticVerdict(response);
    expect(verdict.passed).toBe(false);
    expect(verdict.reason).toContain('Canvas width attribute is missing.');
    expect(verdict.feedback).toBe(response);
    expect(verdict.featureUpdates).toEqual([]);
  });

  it('parseReviewerVerdict returns passed for PASS and PASS_WITH_FIXES', () => {
    expect(miniLoop.parseReviewerVerdict('PASS: Code looks good.').passed).toBe(true);
    expect(miniLoop.parseReviewerVerdict('PASS: Code looks good.').hasFixedCode).toBe(false);
    expect(miniLoop.parseReviewerVerdict('PASS_WITH_FIXES: Fixed missing semicolon').passed).toBe(true);
    expect(miniLoop.parseReviewerVerdict('PASS_WITH_FIXES: Fixed missing semicolon').hasFixedCode).toBe(true);
    expect(miniLoop.parseReviewerVerdict('FAIL: Missing semicolon').passed).toBe(false);
  });
});
