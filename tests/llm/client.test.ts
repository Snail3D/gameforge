import { describe, it, expect } from 'vitest';
import { LLMClient } from '../../src/llm/client.js';

describe('LLMClient', () => {
  const baseUrl = 'http://localhost:11434';
  const model = 'gemma4:moe-chat';

  it('creates client with correct model property', () => {
    const client = new LLMClient({ baseUrl, model });
    expect(client.model).toBe(model);
  });

  it('buildMessages returns system + user messages in correct order', () => {
    const client = new LLMClient({ baseUrl, model });
    const systemPrompt = 'You are a game designer.';
    const userMessage = 'Create a platformer game.';

    const messages = client.buildMessages(systemPrompt, userMessage);

    expect(messages).toHaveLength(2);
    expect(messages[0]).toEqual({ role: 'system', content: systemPrompt });
    expect(messages[1]).toEqual({ role: 'user', content: userMessage });
  });

  it('buildMessages with images returns multimodal content for user message', () => {
    const client = new LLMClient({ baseUrl, model });
    const systemPrompt = 'You are a game designer.';
    const userMessage = 'Analyze this screenshot.';
    const images = [
      { base64: 'abc123', mimeType: 'image/png' },
      { base64: 'def456', mimeType: 'image/jpeg' },
    ];

    const messages = client.buildMessages(systemPrompt, userMessage, undefined, images);

    expect(messages).toHaveLength(2);
    expect(messages[0]).toEqual({ role: 'system', content: systemPrompt });

    const userMsg = messages[1];
    expect(userMsg.role).toBe('user');
    expect(Array.isArray(userMsg.content)).toBe(true);

    const content = userMsg.content as Array<{ type: string; text?: string; image_url?: { url: string } }>;
    expect(content[0]).toEqual({ type: 'text', text: userMessage });
    expect(content[1]).toEqual({
      type: 'image_url',
      image_url: { url: 'data:image/png;base64,abc123' },
    });
    expect(content[2]).toEqual({
      type: 'image_url',
      image_url: { url: 'data:image/jpeg;base64,def456' },
    });
  });

  it('buildMessages includes history between system and final user message', () => {
    const client = new LLMClient({ baseUrl, model });
    const history = [
      { role: 'user' as const, content: 'First message' },
      { role: 'assistant' as const, content: 'First response' },
    ];

    const messages = client.buildMessages('System', 'New message', history);

    expect(messages).toHaveLength(4);
    expect(messages[0].role).toBe('system');
    expect(messages[1]).toEqual(history[0]);
    expect(messages[2]).toEqual(history[1]);
    expect(messages[3].role).toBe('user');
    expect(messages[3].content).toBe('New message');
  });
});
