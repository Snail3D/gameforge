import { describe, it, expect } from 'vitest';
import { Ghost } from '../../src/supervisor/ghost.js';
import type { GhostDatabase } from '../../src/supervisor/ghost.js';

const testDb: GhostDatabase = {
  ghostEntries: [{
    id: 'wall-uv',
    triggers: ['texture', 'UV', 'mapping', 'wall color'],
    context: 'Builder is working on wall textures',
    response: 'Use the fractional part of the ray hit position as the U coordinate.',
    prdReference: 'build-steps #7',
  }],
  knownWeaknesses: [
    { id: 'infinite-loop-risk', description: 'Model writes while(true) without break', detection: 'while(true)', prevention: 'Make sure your loop has an exit condition. Use requestAnimationFrame.' },
    { id: 'scope-creep', description: 'Model tries to implement multiple features', detection: 'step_reference_beyond_current', prevention: "Focus on just this step. We'll get to the rest later." },
  ],
};

describe('Ghost', () => {
  const ghost = new Ghost(testDb);

  it('matches question to ghost entry by trigger keyword', () => {
    const answer = ghost.answerQuestion('How should I handle the UV mapping for textures?');
    expect(answer.entryId).toBe('wall-uv');
    expect(answer.response).toBe('Use the fractional part of the ray hit position as the U coordinate.');
  });

  it('returns default answer for unmatched question', () => {
    const answer = ghost.answerQuestion('What color should the sky be?');
    expect(answer.entryId).toBeUndefined();
    expect(answer.response).toContain('best judgment');
  });

  it('detects known weakness in output', () => {
    const match = ghost.checkWeakness('while(true) { doStuff(); }');
    expect(match).not.toBeNull();
    expect(match!.id).toBe('infinite-loop-risk');
    expect(match!.prevention).toContain('requestAnimationFrame');
  });

  it('does not flag clean output', () => {
    const match = ghost.checkWeakness('function render() { requestAnimationFrame(render); }');
    expect(match).toBeNull();
  });

  it('correctly identifies question patterns', () => {
    expect(ghost.isQuestion('Should I use canvas or WebGL?')).toBe(true);
    expect(ghost.isQuestion('How do I set up the raycaster?')).toBe(true);
    expect(ghost.isQuestion('Adding the sprite renderer now.')).toBe(false);
  });
});
