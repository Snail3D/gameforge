import { describe, it, expect } from 'vitest';
import { FormedBuilder, type FormedBuildStep } from '../../src/supervisor/formed-builder.js';

describe('FormedBuilder', () => {
  it('should extract code from markdown fenced responses', () => {
    // Test the extractAnswer method indirectly by checking it strips fences
    const builder = new FormedBuilder({
      client: {} as any,
      fileTools: {} as any,
      gameDir: '/tmp/test',
    });

    // Access private method via any
    const extract = (builder as any).extractAnswer.bind(builder);

    expect(extract('```js\nconst x = 1;\n```', 'function')).toBe('const x = 1;');
    expect(extract('const x = 1;', 'function')).toBe('const x = 1;');
    expect(extract('```\nfunction draw() {}\n```', 'function')).toBe('function draw() {}');
  });

  it('should build fragment context with prior code', () => {
    const builder = new FormedBuilder({
      client: {} as any,
      fileTools: { readFile: () => { throw new Error('not found'); } } as any,
      gameDir: '/tmp/test',
    });

    const step: FormedBuildStep = {
      stepId: 1,
      title: 'Create paddle',
      files: ['src/paddle.js'],
      fragments: [
        { id: 'props', question: 'What properties?', type: 'properties', file: 'src/paddle.js' },
        { id: 'draw', question: 'Write draw method', type: 'function', file: 'src/paddle.js', dependsOn: ['props'] },
      ],
      encouragement: 'Go!',
    };

    const context = (builder as any).buildFragmentContext(
      step.fragments[1],
      { props: 'const x = 0;\nconst y = 0;' },
      step
    );

    expect(context).toContain('Create paddle');
    expect(context).toContain('src/paddle.js');
    expect(context).toContain('const x = 0;');
    expect(context).toContain('Write draw method');
  });
});
