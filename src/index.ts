import { loadConfig } from './config.js';
import { Supervisor } from './supervisor/supervisor.js';
import { startDashboard } from './dashboard/server.js';
import type { Mode } from './logging/event-types.js';

// Parse CLI args
const args = process.argv.slice(2);
const mode = (args.find(a => a.startsWith('--mode='))?.split('=')[1] || 'build') as Mode;
const prompt = args.filter(a => !a.startsWith('--')).join(' ') || 'Make a fun browser game';
const timerStr = args.find(a => a.startsWith('--timer='))?.split('=')[1];
const timer = timerStr ? parseInt(timerStr, 10) : 120;

const config = loadConfig();

// Start dashboard
const dashboard = startDashboard(config.dashboard.port);

// Start supervisor
const supervisor = new Supervisor({ config, mode, userPrompt: prompt, timer });

// Wire events to dashboard
supervisor.on('event', (event) => {
  dashboard.broadcaster.broadcast(event);
});

supervisor.on('token', ({ agent, token }) => {
  // broadcast streaming token as a minimal event
  dashboard.broadcaster.broadcast({
    type: 'message',
    agent,
    content: token,
    streaming: true,
    ts: new Date().toISOString(),
    model: '',
    tokensIn: 0,
    tokensOut: 0,
    tokPerSec: 0,
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
  Prompt: ${prompt}
  Dashboard: http://localhost:${config.dashboard.port}
`);

supervisor.start().catch(err => {
  console.error('GameForge error:', err);
  process.exit(1);
});
