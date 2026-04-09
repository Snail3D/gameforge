import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'node:http';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EventBroadcaster } from './events.js';

export interface DashboardServer {
  broadcaster: EventBroadcaster;
  close: () => void;
}

export function startDashboard(port: number): DashboardServer {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });
  const broadcaster = new EventBroadcaster(wss);

  // Serve static files from public/ directory
  // Use import.meta.url to resolve __dirname equivalent
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const publicDir = resolve(__dirname, 'public');
  app.use(express.static(publicDir));

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  server.listen(port, () => {
    console.log(`GameForge Dashboard: http://localhost:${port}`);
  });

  return {
    broadcaster,
    close: () => server.close(),
  };
}
