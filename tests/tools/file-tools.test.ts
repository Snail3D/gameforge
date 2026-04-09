import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { FileTools } from '../../src/tools/file-tools.js';

const tempDir = join(tmpdir(), `gameforge-test-${Date.now()}`);

beforeAll(() => {
  mkdirSync(join(tempDir, 'core'), { recursive: true });
  writeFileSync(
    join(tempDir, 'core', 'engine.js'),
    'function init() {}\nfunction update() {}\nfunction render() {}\n',
    'utf-8'
  );
  writeFileSync(join(tempDir, 'index.html'), '<html><body></body></html>\n', 'utf-8');
});

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe('FileTools', () => {
  it('reads a file by relative path', () => {
    const tools = new FileTools(tempDir);
    const content = tools.readFile('core/engine.js');
    expect(content).toContain('function init()');
    expect(content).toContain('function update()');
    expect(content).toContain('function render()');
  });

  it('writes a new file and auto-creates directories', () => {
    const tools = new FileTools(tempDir);
    tools.writeFile('assets/sprites/player.js', 'const player = {};');
    const readBack = tools.readFile('assets/sprites/player.js');
    expect(readBack).toBe('const player = {};');
  });

  it('lists all files as a sorted array', () => {
    const tools = new FileTools(tempDir);
    const files = tools.listFiles();
    expect(Array.isArray(files)).toBe(true);
    expect(files).toContain('core/engine.js');
    expect(files).toContain('index.html');
    // should be sorted
    const sorted = [...files].sort();
    expect(files).toEqual(sorted);
    // no dotfiles
    expect(files.every(f => !f.split('/').some(part => part.startsWith('.')))).toBe(true);
  });

  it('searches code and returns correct file and line number', () => {
    const tools = new FileTools(tempDir);
    const results = tools.searchCode('function update');
    expect(results.length).toBeGreaterThan(0);
    const match = results.find(r => r.file === 'core/engine.js');
    expect(match).toBeDefined();
    expect(match!.line).toBe(2);
    expect(match!.content).toBe('function update() {}');
  });

  it('rejects path traversal attempts', () => {
    const tools = new FileTools(tempDir);
    expect(() => tools.readFile('../../../etc/passwd')).toThrow(Error);
    expect(() => tools.writeFile('../../evil.txt', 'bad')).toThrow(Error);
  });
});
