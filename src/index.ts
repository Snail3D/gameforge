import { loadConfig } from './config.js';
import type { ModelPreset } from './config.js';
import { Supervisor } from './supervisor/supervisor.js';
import { startDashboard } from './dashboard/server.js';
import type { Mode } from './logging/event-types.js';

// Parse CLI args
const args = process.argv.slice(2);
const mode = (args.find(a => a.startsWith('--mode='))?.split('=')[1] || 'build') as Mode;
const prompt = args.filter(a => !a.startsWith('--')).join(' ') || 'Make a fun browser game';
const timerStr = args.find(a => a.startsWith('--timer='))?.split('=')[1];
const timer = timerStr ? parseInt(timerStr, 10) : 120;
const preset = (args.find(a => a.startsWith('--preset='))?.split('=')[1] || process.env['MODEL_PRESET'] || 'dual') as ModelPreset;
const useFormed = args.includes('--formed') || preset === 'e4b' || preset === 'e2b';
const useRecipe = args.includes('--recipe') || preset === 'e4b' || preset === 'e2b';
const skipCritic = args.includes('--no-critic') || preset === 'e4b' || preset === 'e2b';

const config = loadConfig({ preset });

// Start dashboard
const dashboard = startDashboard(config.dashboard.port);

// Start supervisor
const supervisor = new Supervisor({
  config, mode, userPrompt: prompt, timer,
  useFormedBuilder: useFormed,
  useRecipeGenerator: useRecipe,
  skipCritic: skipCritic,
});

// When game directory is created, serve it and tell the dashboard
supervisor.on('game_ready', (gameDir: string) => {
  dashboard.serveGameDir(gameDir);
  dashboard.broadcaster.broadcast({
    type: 'game_ready',
    ts: new Date().toISOString(),
    agent: 'supervisor',
    model: 'none',
    url: '/game/index.html',
  } as any);
});

// Wire all events to dashboard
supervisor.on('event', (event: any) => {
  dashboard.broadcaster.broadcast(event);
});

supervisor.on('token', ({ agent, token }) => {
  dashboard.broadcaster.broadcast({
    type: 'token_stream',
    agent,
    token,
    ts: new Date().toISOString(),
  } as any);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down GameForge...');
  supervisor.stop();
  dashboard.close();
  process.exit(0);
});

// Start
console.log(`
  ⚒ GAMEFORGE
  Mode: ${mode}
  Preset: ${preset}
  FormedBuilder: ${useFormed ? 'ON' : 'OFF'}
  RecipeGenerator: ${useRecipe ? 'ON' : 'OFF'}
  Critic: ${skipCritic ? 'SKIP' : 'ON'}
  Prompt: ${prompt}
  Dashboard: http://localhost:${config.dashboard.port}
`);

supervisor.start().catch(err => {
  console.error('GameForge error:', err);
  process.exit(1);
});
