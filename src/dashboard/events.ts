import { WebSocketServer, WebSocket } from 'ws';
import type { GameForgeEvent } from '../logging/event-types.js';

export class EventBroadcaster {
  private wss: WebSocketServer;
  private eventHistory: GameForgeEvent[] = [];
  private maxHistory: number = 1000;

  constructor(wss: WebSocketServer) {
    this.wss = wss;
    // On new connection: replay full event history to new client
    this.wss.on('connection', (ws: WebSocket) => {
      for (const event of this.eventHistory) {
        ws.send(JSON.stringify(event));
      }
    });
  }

  broadcast(event: GameForgeEvent): void {
    // Store in history (shift if > maxHistory)
    // Send JSON to all open clients
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistory) this.eventHistory.shift();
    const data = JSON.stringify(event);
    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  getHistory(): GameForgeEvent[] {
    return [...this.eventHistory];
  }
}
