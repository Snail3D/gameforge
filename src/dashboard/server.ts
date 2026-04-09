import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'node:http';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EventBroadcaster } from './events.js';

export interface DashboardServer {
  broadcaster: EventBroadcaster;
  close: () => void;
  serveGameDir: (gameDir: string) => void;
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

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  // Serve game files at /game/ — set dynamically when game dir is known
  let currentGameDir: string | null = null;
  app.use('/game', (req, res, next) => {
    if (!currentGameDir) {
      res.status(404).send('No game loaded yet');
      return;
    }
    express.static(currentGameDir)(req, res, next);
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
  };
}
