import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'node:http';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EventBroadcaster } from './events.js';

export interface DashboardServer {
  broadcaster: EventBroadcaster;
  close: () => void;
  serveGameDir: (gameDir: string) => void;
  onStart: (callback: (opts: { prompt: string; mode: string; preset: string }) => void) => void;
}

export function startDashboard(port: number): DashboardServer {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });
  const broadcaster = new EventBroadcaster(wss);

  // Serve static files from public/ directory
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const publicDir = resolve(__dirname, 'public');
  app.use(express.static(publicDir));

  app.use(express.json());

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  // === GAMEFORGE API — for Hermes skills and external tools ===

  // GET /api/status — current build status
  app.get('/api/status', (_req, res) => {
    const history = broadcaster.getHistory();
    const steps = history.filter((e: any) => e.type === 'step_update');
    const lastStats = [...history].reverse().find((e: any) => e.type === 'system_stats') as any;
    const passed = steps.filter((e: any) => e.status === 'passed').length;
    const failed = steps.filter((e: any) => e.status === 'failed').length;
    const skipped = steps.filter((e: any) => e.status === 'skipped').length;

    res.json({
      running: history.length > 0,
      gameDir: currentGameDir,
      steps: { passed, failed, skipped },
      cycles: lastStats?.cycles || 0,
      uptimeSeconds: lastStats?.uptimeSeconds || 0,
      totalEvents: history.length,
    });
  });

  // GET /api/steps — list all steps with status
  app.get('/api/steps', (_req, res) => {
    const history = broadcaster.getHistory();
    const stepMap = new Map<string, any>();

    for (const event of history) {
      const e = event as any;
      if (e.type === 'step_assign') {
        stepMap.set(e.stepId, { stepId: e.stepId, title: e.title, status: 'in_progress', attempt: 0 });
      } else if (e.type === 'step_update') {
        const step = stepMap.get(e.stepId);
        if (step) {
          step.status = e.status;
          step.attempt = e.attempt;
        }
      }
    }

    res.json({ steps: Array.from(stepMap.values()) });
  });

  // GET /api/messages — recent agent messages
  app.get('/api/messages', (req, res) => {
    const limit = parseInt(req.query.limit as string) || 20;
    const history = broadcaster.getHistory();
    const messages = history
      .filter((e: any) => e.type === 'message')
      .slice(-limit)
      .map((e: any) => ({
        agent: e.agent,
        content: e.content?.substring(0, 500),
        model: e.model,
        tokPerSec: e.tokPerSec,
        ts: e.ts,
      }));
    res.json({ messages });
  });

  // GET /api/game — get current game files
  app.get('/api/game/files', (_req, res) => {
    if (!currentGameDir) {
      res.status(404).json({ error: 'No game in progress' });
      return;
    }
    const fs = require('fs');
    const path = require('path');
    const files: Record<string, string> = {};
    try {
      const entries = fs.readdirSync(currentGameDir);
      for (const entry of entries) {
        const fullPath = path.join(currentGameDir, entry);
        const stat = fs.statSync(fullPath);
        if (stat.isFile() && !entry.endsWith('.backup') && !entry.startsWith('.')) {
          files[entry] = fs.readFileSync(fullPath, 'utf-8');
        }
      }
    } catch { /* ignore */ }
    res.json({ gameDir: currentGameDir, files });
  });

  // POST /api/start — start a new game build (for Hermes skill)
  // Body: { prompt: "Make a chess game", mode: "build", preset: "e4b" }
  let onStartCallback: ((opts: { prompt: string; mode: string; preset: string }) => void) | null = null;

  app.post('/api/start', (req, res) => {
    const { prompt, mode, preset } = req.body || {};
    if (!prompt) {
      res.status(400).json({ error: 'prompt is required' });
      return;
    }
    if (onStartCallback) {
      onStartCallback({ prompt, mode: mode || 'build', preset: preset || 'e4b' });
      res.json({ status: 'started', prompt, mode: mode || 'build', preset: preset || 'e4b' });
    } else {
      res.status(503).json({ error: 'No start handler registered' });
    }
  });

  // Screenshot capture — dashboard client captures via iframe postMessage and sends back
  let pendingScreenshot: { resolve: (data: any) => void; timeout: ReturnType<typeof setTimeout> } | null = null;

  app.post('/api/screenshot', (_req, res) => {
    if (pendingScreenshot) {
      res.status(429).json({ error: 'Screenshot already pending' });
      return;
    }

    // Ask all connected clients to take a screenshot
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'request_screenshot' }));
      }
    }

    // Wait for response (dashboard client sends it back via WebSocket)
    const promise = new Promise<any>((resolve) => {
      const timeout = setTimeout(() => {
        pendingScreenshot = null;
        resolve({ screenshot: null, errors: [{ type: 'timeout', message: 'No screenshot response in 5s' }] });
      }, 5000);
      pendingScreenshot = { resolve, timeout };
    });

    promise.then(data => res.json(data));
  });

  // Serve game files at /game/ — set dynamically when game dir is known
  let currentGameDir: string | null = null;
  app.use('/game', (req, res, next) => {
    if (!currentGameDir) {
      res.status(404).send('No game loaded yet');
      return;
    }
    // No caching — game files change constantly during build
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    express.static(currentGameDir)(req, res, next);
  });

  // Handle incoming WebSocket messages — screenshot responses from dashboard clients
  wss.on('connection', (ws) => {
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw));
        if (msg.type === 'screenshot-response' && pendingScreenshot) {
          clearTimeout(pendingScreenshot.timeout);
          pendingScreenshot.resolve(msg);
          pendingScreenshot = null;
        }
      } catch { /* ignore malformed */ }
    });
  });

  server.listen(port, () => {
    console.log(`GameForge Dashboard: http://localhost:${port}`);
  });

  return {
    broadcaster,
    close: () => server.close(),
    serveGameDir: (gameDir: string) => {
      currentGameDir = gameDir;
    },
    onStart: (callback) => {
      onStartCallback = callback;
    },
  };
}
