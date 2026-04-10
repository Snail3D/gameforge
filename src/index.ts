import 'dotenv/config';
import { loadConfig } from './config.js';
import type { ModelPreset } from './config.js';
import { RalphLoop } from './supervisor/ralph-loop.js';
import { startDashboard } from './dashboard/server.js';

// Parse CLI args
const args = process.argv.slice(2);
const prompt = args.filter(a => !a.startsWith('--')).join(' ') || 'Make a fun browser game';
const preset = (args.find(a => a.startsWith('--preset='))?.split('=')[1] || process.env['MODEL_PRESET'] || 'single') as ModelPreset;

const config = loadConfig({ preset });
const dashboard = startDashboard(config.dashboard.port);

// Ralph Loop — one agent, one model, infinite iteration
const loop = new RalphLoop({ config, mode: 'build', userPrompt: prompt });

loop.on('game_ready', (gameDir: string) => {
  dashboard.serveGameDir(gameDir);
  dashboard.broadcaster.broadcast({
    type: 'game_ready', ts: new Date().toISOString(),
    agent: 'supervisor', model: 'none', url: '/game/index.html',
  } as any);
});

loop.on('event', (event: any) => {
  dashboard.broadcaster.broadcast(event);
});

loop.on('token', ({ agent, token }) => {
  dashboard.broadcaster.broadcast({
    type: 'token_stream', agent, token, ts: new Date().toISOString(),
  } as any);
});

process.on('SIGINT', () => {
  loop.stop();
  dashboard.close();
  process.exit(0);
});

console.log(`
  ⚒ GAMEFORGE — Ralph Loop
  Preset: ${preset}
  Model: ${config.ollama.models.builder}
  Prompt: ${prompt}
  Dashboard: http://localhost:${config.dashboard.port}
`);

loop.start().catch(err => {
  console.error('GameForge error:', err);
  process.exit(1);
});
