/**
 * Ralph Loop — single agent, single model, infinite iteration.
 * One model sees the game, writes code, checks its work, keeps going.
 */

import { EventEmitter } from 'node:events';
import { LLMClient } from '../llm/client.js';
import { FileTools } from '../tools/file-tools.js';
import { ModelManager } from '../llm/model-manager.js';
import { SessionLogger } from '../logging/session-logger.js';
import { captureGameScreenshot } from '../tools/screenshot.js';
import type { GameForgeConfig } from '../config.js';
import type { Mode } from '../logging/event-types.js';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync, } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';

const SYSTEM_PROMPT = 'You are GameForge, an autonomous game developer. You build HTML5 canvas games from scratch, iteratively improving them each cycle.\n\nEach cycle you receive the current game files and a screenshot. You respond with:\n1. Brief assessment (1-2 sentences)\n2. What you will do this cycle (1 sentence)\n3. COMPLETE updated files in code blocks with paths like ```js:game.js\n\nRules:\n- Canvas is ALWAYS 400x700 (portrait, mobile-first)\n- index.html MUST have <script src="game.js"></script>\n- Vanilla JS only. No frameworks.\n- Every cycle must produce a visible improvement\n- Write COMPLETE files, not snippets\n- Make the game FUN — good colors, smooth animations, satisfying feedback\n- Touch controls alongside keyboard/mouse\n- Focus on ONE thing per cycle: add a feature, fix a bug, or polish';

export interface RalphLoopOptions {
  config: GameForgeConfig;
  mode: Mode;
  userPrompt: string;
}

export class RalphLoop extends EventEmitter {
  private config: GameForgeConfig;
  private userPrompt: string;
  private running = false;
  private client!: LLMClient;
  private fileTools!: FileTools;
  private logger!: SessionLogger;
  private modelManager: ModelManager;
  private gameDir = '';
  private metaDir = '';
  private startTime = 0;
  private cycle = 0;

  constructor(options: RalphLoopOptions) {
    super();
    this.config = options.config;
    this.userPrompt = options.userPrompt;
    this.modelManager = new ModelManager(this.config.ollama.host);
  }

  getGameDir(): string { return this.gameDir; }

  async start(): Promise<void> {
    this.running = true;
    this.startTime = Date.now();

    // Clean Metal
    try {
      const loaded = await this.modelManager.getLoadedModels();
      for (const m of loaded) await this.modelManager.unloadModel(m.name);
    } catch {}

    // Setup
    const slug = this.userPrompt.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
    this.gameDir = join(this.config.gamesDir, slug);
    this.metaDir = join(this.gameDir, '_meta');
    mkdirSync(this.gameDir, { recursive: true });
    mkdirSync(this.metaDir, { recursive: true });

    this.fileTools = new FileTools(this.gameDir);
    this.logger = new SessionLogger(this.metaDir, slug);

    // Seed files
    this.fileTools.writeFile('index.html',
      '<!DOCTYPE html>\n<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0,user-scalable=no"><title>Game</title><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#111;display:flex;justify-content:center;align-items:center;height:100vh;overflow:hidden}canvas{background:#000;max-width:100vw;max-height:100vh}</style></head><body><canvas id="gameCanvas" width="400" height="700"></canvas><script src="game.js"></script></body></html>'
    );
    this.fileTools.writeFile('game.js',
      'const canvas=document.getElementById("gameCanvas"),ctx=canvas.getContext("2d"),W=400,H=700;ctx.fillStyle="#111";ctx.fillRect(0,0,W,H);ctx.fillStyle="#0f0";ctx.font="20px monospace";ctx.textAlign="center";ctx.fillText("Building...",W/2,H/2);'
    );

    const model = this.config.ollama.models.builder;
    const skipLoad = ['minimax', 'qwopus'].includes(this.config.preset);
    if (!skipLoad) { try { await this.modelManager.loadModel(model); } catch {} }

    this.client = new LLMClient({
      baseUrl: this.config.ollama.host,
      model,
      apiKey: this.config.ollama.apiKey,
    });

    this.emit('game_ready', this.gameDir);
    this.emitEvent({ type: 'message', ts: new Date().toISOString(), agent: 'supervisor', model: 'none', content: 'Ralph Loop: "' + this.userPrompt + '"', tokensIn: 0, tokensOut: 0, tokPerSec: 0 });

    while (this.running) {
      await this.runCycle();
      this.cycle++;
      this.emitEvent({ type: 'system_stats', ts: new Date().toISOString(), agent: 'supervisor', model, gpuMB: 0, uptimeSeconds: (Date.now() - this.startTime) / 1000, cycles: this.cycle, loopsCaught: 0, stepsCompleted: this.cycle, stepsTotal: this.cycle + 1 });
    }
  }

  stop(): void { this.running = false; this.logger?.close(); }

  private async runCycle(): Promise<void> {
    const model = this.config.ollama.models.builder;

    // Read all game files
    let gameFiles = '';
    try {
      for (const f of this.fileTools.listFiles()) {
        if (f.endsWith('.backup') || f.includes('_meta')) continue;
        try { gameFiles += '\n--- ' + f + ' ---\n' + this.fileTools.readFile(f) + '\n'; } catch {}
      }
    } catch {}

    // Screenshot
    let images: Array<{ base64: string; mimeType: string }> = [];
    try {
      const ss = await captureGameScreenshot(this.gameDir, this.metaDir, this.cycle);
      if (ss.base64) {
        images = [{ base64: ss.base64, mimeType: 'image/png' }];
        this.emitEvent({ type: 'screenshot', ts: new Date().toISOString(), agent: 'builder', model, path: ss.path, base64: ss.base64, description: 'Cycle ' + this.cycle });
      }
    } catch {}

    const prompt = this.cycle === 0
      ? 'Build this game from scratch: "' + this.userPrompt + '"\n\nMake something visible immediately. Current files:\n' + gameFiles
      : 'Cycle ' + this.cycle + ' of "' + this.userPrompt + '". Look at the screenshot. Add the next feature or fix the biggest issue.\n\nCurrent files:\n' + gameFiles;

    this.emitEvent({ type: 'step_assign', ts: new Date().toISOString(), agent: 'supervisor', model: 'none', stepId: String(this.cycle + 1), title: 'Cycle ' + (this.cycle + 1) });

    const response = await this.client.chat(
      this.client.buildMessages(SYSTEM_PROMPT, prompt, undefined, images),
      { onToken: (token) => this.emit('token', { agent: 'builder', token }) }
    );

    this.emitEvent({ type: 'message', ts: new Date().toISOString(), agent: 'builder', model, content: response.content.substring(0, 500), tokensIn: response.tokensIn, tokensOut: response.tokensOut, tokPerSec: response.tokensOut / (response.durationMs / 1000) });

    const saved = this.extractAndSave(response.content);
    if (saved.length > 0) {
      this.emitEvent({ type: 'tool_call', ts: new Date().toISOString(), agent: 'builder', model, tool: 'write_file', args: { files: saved }, result: 'Saved: ' + saved.join(', ') });
      this.emitEvent({ type: 'step_update', ts: new Date().toISOString(), agent: 'supervisor', model, stepId: String(this.cycle + 1), status: 'passed', attempt: 1 });
    }
  }

  private extractAndSave(content: string): string[] {
    const cleaned = content.replace(/<think>[\s\S]*?<\/think>/gi, '');
    const saved: string[] = [];
    const pattern = /```(?:html|js|javascript|css)[:\s]+([^\n`]+)\n([\s\S]*?)```/gi;
    let match;

    while ((match = pattern.exec(cleaned)) !== null) {
      const filePath = match[1].trim();
      const code = match[2].trim();
      if (!filePath || !code || !filePath.includes('.')) continue;
      if (filePath.endsWith('.js') && !this.checkSyntax(code)) {
        this.emitEvent({ type: 'message', ts: new Date().toISOString(), agent: 'supervisor', model: 'none', content: 'Syntax error in ' + filePath + ' — skipped', tokensIn: 0, tokensOut: 0, tokPerSec: 0 });
        continue;
      }
      try { this.fileTools.writeFile(filePath + '.backup', this.fileTools.readFile(filePath)); } catch {}
      this.fileTools.writeFile(filePath, code);
      saved.push(filePath);
    }

    // Fallback: bare ```js block → game.js
    if (saved.length === 0) {
      const bare = /```(?:javascript|js)\n([\s\S]*?)```/gi;
      while ((match = bare.exec(cleaned)) !== null) {
        const code = match[1].trim();
        if (code && this.checkSyntax(code)) {
          try { this.fileTools.writeFile('game.js.backup', this.fileTools.readFile('game.js')); } catch {}
          this.fileTools.writeFile('game.js', code);
          saved.push('game.js');
          break;
        }
      }
    }
    return saved;
  }

  private checkSyntax(code: string): boolean {
    const tmp = join(tmpdir(), 'gf-' + Date.now() + '.js');
    try {
      writeFileSync(tmp, code);
      execFileSync('node', ['--check', tmp], { stdio: 'pipe' });
      return true;
    } catch { return false; }
    finally { try { unlinkSync(tmp); } catch {} }
  }

  private emitEvent(event: any): void {
    if (this.logger) this.logger.log(event);
    this.emit('event', event);
  }
}
