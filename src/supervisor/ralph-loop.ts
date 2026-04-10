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

const SYSTEM_PROMPT = 'You are GameForge, an autonomous game developer. You build HTML5 canvas games iteratively.\n\nEach cycle you receive: game files, a vision report from Scout (who SEES the game), and optionally an answer to a question you asked last cycle.\n\nRespond with:\n1. Brief assessment (1-2 sentences)\n2. What you will do (1 sentence)\n3. COMPLETE updated files in ```js:game.js blocks\n4. OPTIONAL: Ask Scout to check something visually next cycle:\nSCOUT_QUESTION: [your question]\n\nExamples:\nSCOUT_QUESTION: Are all 8 pawns visible on each side? Count them.\nSCOUT_QUESTION: Is the turn indicator overlapping any pieces?\nSCOUT_QUESTION: Does the selected piece highlight show up? What color?\n\nRules:\n- Canvas 400x700 (portrait, mobile-first)\n- index.html MUST have <script src="game.js"></script>\n- Vanilla JS only\n- Every cycle = visible improvement\n- COMPLETE files, not snippets\n- Make it FUN\n- Touch + keyboard controls\n- ONE thing per cycle';

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
  private lastScoutAnswer = '';  // Carries over Builder's Scout Q&A to next cycle

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

    // Screenshot — use E4B (multimodal) to describe what it sees
    let visionDescription = '';
    try {
      const ss = await captureGameScreenshot(this.gameDir, this.metaDir, this.cycle);
      if (ss.base64) {
        this.emitEvent({ type: 'screenshot', ts: new Date().toISOString(), agent: 'scout', model: 'gemma4:e4b', path: ss.path, base64: ss.base64, description: 'Cycle ' + this.cycle });

        // Ask E4B to describe what it sees
        if (this.cycle > 0) {
          try {
            const visionClient = new LLMClient({
              baseUrl: this.config.ollama.host,
              model: 'gemma4:e4b',
            });
            const visionResponse = await visionClient.chat(
              visionClient.buildMessages(
                'Describe what you see in this game screenshot in 2-3 sentences. Focus on: what is rendered, what works, what looks broken or missing.',
                'Describe this game screenshot:',
                undefined,
                [{ base64: ss.base64, mimeType: 'image/png' }]
              )
            );
            visionDescription = '\n\nVISION REPORT (E4B sees the game): ' + visionResponse.content;
            this.emitEvent({ type: 'message', ts: new Date().toISOString(), agent: 'scout', model: 'gemma4:e4b', content: 'Vision: ' + visionResponse.content.substring(0, 300), tokensIn: visionResponse.tokensIn, tokensOut: visionResponse.tokensOut, tokPerSec: visionResponse.tokensOut / (visionResponse.durationMs / 1000) });
          } catch {}
        }
      }
    } catch {}

    // Check if any file is too large — if so, tell model to split
    let fileSizeWarning = '';
    try {
      for (const f of this.fileTools.listFiles()) {
        if (f.endsWith('.backup') || f.includes('_meta')) continue;
        try {
          const lines = this.fileTools.readFile(f).split('\n').length;
          if (lines > 250) {
            fileSizeWarning = '\n\nWARNING: ' + f + ' is ' + lines + ' lines — TOO BIG. This cycle you MUST split it into multiple smaller files (under 200 lines each). Move related functions into separate files (e.g., board.js, pieces.js, moves.js, ai.js). Update index.html to load all files with <script> tags in the right order. Global variables and constants go in the first file loaded.';
            break;
          }
        } catch {}
      }
    } catch {}

    const prompt = this.cycle === 0
      ? 'Build this game from scratch: "' + this.userPrompt + '"\n\nMake something visible immediately. Current files:\n' + gameFiles
      : 'Cycle ' + this.cycle + ' of "' + this.userPrompt + '". Add the next feature or fix the biggest issue.' + visionDescription + this.lastScoutAnswer + fileSizeWarning + '\n\nCurrent files:\n' + gameFiles;

    this.emitEvent({ type: 'step_assign', ts: new Date().toISOString(), agent: 'supervisor', model: 'none', stepId: String(this.cycle + 1), title: 'Cycle ' + (this.cycle + 1) });

    const response = await this.client.chat(
      this.client.buildMessages(SYSTEM_PROMPT, prompt),
      { onToken: (token) => this.emit('token', { agent: 'builder', token }) }
    );

    this.emitEvent({ type: 'message', ts: new Date().toISOString(), agent: 'builder', model, content: response.content.substring(0, 500), tokensIn: response.tokensIn, tokensOut: response.tokensOut, tokPerSec: response.tokensOut / (response.durationMs / 1000) });

    const saved = this.extractAndSave(response.content);
    if (saved.length > 0) {
      this.emitEvent({ type: 'tool_call', ts: new Date().toISOString(), agent: 'builder', model, tool: 'write_file', args: { files: saved }, result: 'Saved: ' + saved.join(', ') });
      this.emitEvent({ type: 'step_update', ts: new Date().toISOString(), agent: 'supervisor', model, stepId: String(this.cycle + 1), status: 'passed', attempt: 1 });
    }

    // Check if Builder asked Scout a question
    const scoutMatch = /SCOUT_QUESTION:\s*(.+)/i.exec(response.content);
    if (scoutMatch) {
      const question = scoutMatch[1].trim();
      this.emitEvent({ type: 'message', ts: new Date().toISOString(), agent: 'builder', model, content: 'Asking Scout: ' + question, tokensIn: 0, tokensOut: 0, tokPerSec: 0 });

      try {
        // Take fresh screenshot after files were saved
        const freshSs = await captureGameScreenshot(this.gameDir, this.metaDir, this.cycle);
        if (freshSs.base64) {
          const visionClient = new LLMClient({ baseUrl: this.config.ollama.host, model: 'gemma4:e4b' });
          const answer = await visionClient.chat(
            visionClient.buildMessages(
              'You are a visual QA tester looking at a game screenshot. Answer the developer\'s question honestly and specifically. If something is wrong, say exactly what and where.',
              question,
              undefined,
              [{ base64: freshSs.base64, mimeType: 'image/png' }]
            )
          );
          this.lastScoutAnswer = '\n\nSCOUT ANSWER (from last cycle): Q: ' + question + '\nA: ' + answer.content;
          this.emitEvent({ type: 'message', ts: new Date().toISOString(), agent: 'scout', model: 'gemma4:e4b', content: 'Answer: ' + answer.content.substring(0, 300), tokensIn: answer.tokensIn, tokensOut: answer.tokensOut, tokPerSec: answer.tokensOut / (answer.durationMs / 1000) });
        }
      } catch { this.lastScoutAnswer = ''; }
    } else {
      this.lastScoutAnswer = '';
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
