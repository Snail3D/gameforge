import { describe, it, expect, beforeEach } from 'vitest';
import { LoopDetector } from '../../src/supervisor/loop-detector.js';

describe('LoopDetector', () => {
  let detector: LoopDetector;

  beforeEach(() => {
    detector = new LoopDetector();
  });

  it('detects repeated phrases (token repeat)', () => {
    const text = 'function render() { function render() { function render() { function render() {';
    expect(detector.checkTokenRepeat(text)).toBe(true);
  });

  it('does not flag normal code for token repeat', () => {
    const text = `function render() {
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  ctx.fillRect(0, 0, 100, 100);
}`;
    expect(detector.checkTokenRepeat(text)).toBe(false);
  });

  it('detects repeated lines', () => {
    const text = 'hello\nhello\nhello\nhello\nhello\nhello';
    expect(detector.checkLineRepeat(text)).toBe(true);
  });

  it('detects stagnation across similar chunks', () => {
    detector.reset();
    const base = 'wall render bricks left right top bottom canvas ctx draw fill stroke update loop frame game screen pixel color tile';
    detector.addChunk(base);
    detector.addChunk(base + ' alpha');
    detector.addChunk(base + ' beta');
    expect(detector.checkStagnation()).toBe(true);
  });

  it('detects runaway output when no code blocks present', () => {
    const longText = 'a'.repeat(250);
    const d = new LoopDetector({ maxOutputLength: 100 });
    expect(d.checkRunaway(longText, false)).toBe(true);
  });

  it('does not flag runaway if code blocks are present', () => {
    const longText = 'a'.repeat(250);
    const d = new LoopDetector({ maxOutputLength: 100 });
    expect(d.checkRunaway(longText, true)).toBe(false);
  });

  it('recovery message attempt 1 mentions coffee', () => {
    const msg = detector.getRecoveryMessage(1, 'Render walls');
    expect(msg.toLowerCase()).toContain('coffee');
  });

  it('recovery message attempt 2 mentions looped again', () => {
    const msg = detector.getRecoveryMessage(2, 'Render walls');
    expect(msg.toLowerCase()).toContain('looped again');
  });

  it('recovery message attempt 3 mentions fresh start', () => {
    const msg = detector.getRecoveryMessage(3, 'Render walls');
    expect(msg.toLowerCase()).toContain('fresh start');
  });

  it('recovery message attempt 4+ mentions come back', () => {
    const msg = detector.getRecoveryMessage(4, 'Render walls');
    expect(msg.toLowerCase()).toContain('come back');
  });
});
