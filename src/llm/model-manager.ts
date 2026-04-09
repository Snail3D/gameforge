export interface ModelInfo {
  name: string;
  size: number; // bytes
  loaded: boolean;
}

export class ModelManager {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async listModels(): Promise<ModelInfo[]> {
    const response = await fetch(`${this.baseUrl}/api/tags`);
    if (!response.ok) {
      throw new Error(`Failed to list models: ${response.status} ${response.statusText}`);
    }
    const data = (await response.json()) as {
      models: Array<{ name: string; size: number }>;
    };
    return (data.models ?? []).map((m) => ({ name: m.name, size: m.size, loaded: false }));
  }

  async getLoadedModels(): Promise<ModelInfo[]> {
    const response = await fetch(`${this.baseUrl}/api/ps`);
    if (!response.ok) {
      throw new Error(`Failed to get loaded models: ${response.status} ${response.statusText}`);
    }
    const data = (await response.json()) as {
      models: Array<{ name: string; size: number }>;
    };
    return (data.models ?? []).map((m) => ({ name: m.name, size: m.size, loaded: true }));
  }

  async loadModel(model: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: '', keep_alive: -1 }),
    });
    if (!response.ok) {
      throw new Error(`Failed to load model ${model}: ${response.status} ${response.statusText}`);
    }
    // Drain the response body
    await response.body?.cancel();
  }

  async unloadModel(model: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: '', keep_alive: 0 }),
    });
    if (!response.ok) {
      throw new Error(
        `Failed to unload model ${model}: ${response.status} ${response.statusText}`,
      );
    }
    await response.body?.cancel();
  }

  async isModelLoaded(model: string): Promise<boolean> {
    const loaded = await this.getLoadedModels();
    return loaded.some((m) => m.name === model);
  }

  async swapModel(load: string, unload?: string): Promise<void> {
    if (unload !== undefined) {
      await this.unloadModel(unload);
    }
    await this.loadModel(load);
  }

  getMemoryMB(models: ModelInfo[]): number {
    const totalBytes = models.reduce((sum, m) => sum + m.size, 0);
    return totalBytes / (1024 * 1024);
  }
}
