export interface LLMClientConfig {
  baseUrl: string;
  model: string;
}

export interface ImageAttachment {
  base64: string;
  mimeType: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

export interface ChatResponse {
  content: string;
  tokensIn: number;
  tokensOut: number;
  durationMs: number;
}

export interface StreamCallbacks {
  onToken?: (token: string) => void;
  onDone?: (response: ChatResponse) => void;
}

export class LLMClient {
  readonly model: string;
  private baseUrl: string;

  constructor(config: LLMClientConfig) {
    this.baseUrl = config.baseUrl;
    this.model = config.model;
  }

  buildMessages(
    systemPrompt: string,
    userMessage: string,
    history?: ChatMessage[],
    images?: ImageAttachment[],
  ): ChatMessage[] {
    const messages: ChatMessage[] = [{ role: 'system', content: systemPrompt }];

    if (history && history.length > 0) {
      messages.push(...history);
    }

    if (images && images.length > 0) {
      const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
        { type: 'text', text: userMessage },
        ...images.map((img) => ({
          type: 'image_url',
          image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
        })),
      ];
      messages.push({ role: 'user', content });
    } else {
      messages.push({ role: 'user', content: userMessage });
    }

    return messages;
  }

  async chat(messages: ChatMessage[], callbacks?: StreamCallbacks): Promise<ChatResponse> {
    const startMs = Date.now();
    const stream = callbacks?.onToken !== undefined;

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM request failed: ${response.status} ${response.statusText}`);
    }

    if (stream && response.body) {
      return this.handleStream(response.body, startMs, callbacks!);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
      usage?: { prompt_tokens: number; completion_tokens: number };
    };

    const content = data.choices[0]?.message?.content ?? '';
    const result: ChatResponse = {
      content,
      tokensIn: data.usage?.prompt_tokens ?? 0,
      tokensOut: data.usage?.completion_tokens ?? 0,
      durationMs: Date.now() - startMs,
    };

    callbacks?.onDone?.(result);
    return result;
  }

  private async handleStream(
    body: ReadableStream<Uint8Array>,
    startMs: number,
    callbacks: StreamCallbacks,
  ): Promise<ChatResponse> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let accumulated = '';
    let tokensIn = 0;
    let tokensOut = 0;
    let tokenCount = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;

          const jsonStr = trimmed.slice(5).trim();
          if (jsonStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(jsonStr) as {
              choices: Array<{ delta?: { content?: string } }>;
              usage?: { prompt_tokens: number; completion_tokens: number };
            };

            const token = parsed.choices[0]?.delta?.content;
            if (token) {
              accumulated += token;
              tokenCount++;
              callbacks.onToken?.(token);
            }

            if (parsed.usage) {
              tokensIn = parsed.usage.prompt_tokens;
              tokensOut = parsed.usage.completion_tokens;
            }
          } catch {
            // skip malformed SSE lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Use stream-counted tokens if Ollama didn't provide usage stats
    if (tokensOut === 0) tokensOut = tokenCount;

    const result: ChatResponse = {
      content: accumulated,
      tokensIn,
      tokensOut,
      durationMs: Date.now() - startMs,
    };

    callbacks.onDone?.(result);
    return result;
  }
}
