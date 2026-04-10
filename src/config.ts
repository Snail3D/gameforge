import { resolve } from 'path';

export type ModelPreset = 'dual' | 'single' | 'e4b' | 'e2b';

export interface ReviewerProvider {
  baseUrl: string;
  model: string;
  apiKey?: string;
}

export interface GameForgeConfig {
  ollama: {
    host: string;
    models: {
      planner: string;
      builder: string;
      reviewer: string;
      critic: string;
      scout: string;
    };
  };
  reviewer?: ReviewerProvider;  // Optional cloud reviewer (MiniMax, etc.)
  dashboard: {
    port: number;
  };
  github: {
    repo: string;
  };
  formspreeId: string;
  gamesDir: string;
  preset: ModelPreset;
}

export function loadConfig(overrides?: Partial<GameForgeConfig>): GameForgeConfig {
  const preset = (overrides?.preset ?? process.env['MODEL_PRESET'] ?? 'dual') as ModelPreset;

  const presets: Record<ModelPreset, GameForgeConfig['ollama']['models']> = {
    // Default: big planner + MoE workers
    dual: {
      planner: 'gpt-oss:120b',
      builder: 'gemma4:moe-chat',
      reviewer: 'gemma4:moe-chat',
      critic: 'gemma4:moe-chat',
      scout: 'gemma4:e4b',
    },
    // Single MoE model for everything
    single: {
      planner: 'gemma4:moe-chat',
      builder: 'gemma4:moe-chat',
      reviewer: 'gemma4:moe-chat',
      critic: 'gemma4:moe-chat',
      scout: 'gemma4:moe-chat',
    },
    // E4B only — runs on 16GB devices
    e4b: {
      planner: 'gemma4:e4b',
      builder: 'gemma4:e4b',
      reviewer: 'gemma4:e4b',
      critic: 'gemma4:e4b',
      scout: 'gemma4:e4b',
    },
    // E2B only — runs on 8GB devices (phones!)
    e2b: {
      planner: 'gemma4:e2b',
      builder: 'gemma4:e2b',
      reviewer: 'gemma4:e2b',
      critic: 'gemma4:e2b',
      scout: 'gemma4:e2b',
    },
  };

  return {
    ollama: {
      host: process.env['OLLAMA_HOST'] ?? 'http://localhost:11434',
      models: presets[preset],
    },
    dashboard: {
      port: parseInt(process.env['DASHBOARD_PORT'] ?? '9191', 10),
    },
    github: {
      repo: process.env['GITHUB_REPO'] ?? 'Snail3D/snail-arcade',
    },
    formspreeId: process.env['FORMSPREE_ID'] ?? '',
    gamesDir: resolve(process.cwd(), 'games'),
    preset,
    // Cloud reviewer (MiniMax) — if MINIMAX_API_KEY is set, use it for reviews
    ...(process.env['MINIMAX_API_KEY'] ? {
      reviewer: {
        baseUrl: process.env['MINIMAX_BASE_URL'] ?? 'https://api.minimax.io/v1',
        model: process.env['MINIMAX_MODEL'] ?? 'MiniMax-M2.7-highspeed',
        apiKey: process.env['MINIMAX_API_KEY'],
      },
    } : {}),
  };
}
