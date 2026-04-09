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
  };
}
