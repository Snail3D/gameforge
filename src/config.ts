import { resolve } from 'path';

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
  dashboard: {
    port: number;
  };
  github: {
    repo: string;
  };
  formspreeId: string;
  gamesDir: string;
}

export function loadConfig(): GameForgeConfig {
  return {
    ollama: {
      host: process.env['OLLAMA_HOST'] ?? 'http://localhost:11434',
      models: {
        planner: 'gpt-oss:120b',
        builder: 'gemma4:moe-chat',
        reviewer: 'gemma4:moe-chat',
        critic: 'gemma4:moe-chat',
        scout: 'gemma4:e4b',
      },
    },
    dashboard: {
      port: parseInt(process.env['DASHBOARD_PORT'] ?? '9191', 10),
    },
    github: {
      repo: process.env['GITHUB_REPO'] ?? 'Snail3D/snail-arcade',
    },
    formspreeId: process.env['FORMSPREE_ID'] ?? '',
    gamesDir: resolve(process.cwd(), 'games'),
  };
}
