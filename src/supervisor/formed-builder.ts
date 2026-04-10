/**
 * FormedBuilder — Full-file code generation for small models.
 *
 * Simple approach that actually works:
 * - Step 1: Model writes complete index.html + game.js from scratch
 * - Step 2+: Model receives the FULL current game.js + step instructions,
 *   writes the COMPLETE updated game.js
 * - No merge, no append, no function extraction
 * - Syntax validation after each write, rollback if broken
 */

import { LLMClient } from '../llm/client.js';
import { FileTools } from '../tools/file-tools.js';
import type { StepDefinition } from '../agents/types.js';
import { EventEmitter } from 'node:events';
import { execFileSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export interface CodeFragment {
  id: string;
  question: string;
  infer_from?: string;
  type: 'full_file' | 'html';
  file: string;
  dependsOn?: string[];
}

export interface FormedBuildStep {
  stepId: number;
  title: string;
  files: string[];
  fragments: CodeFragment[];
  assemblyTemplate?: string;
  encouragement: string;
}

export interface FormedBuilderConfig {
  client: LLMClient;
  fileTools: FileTools;
  gameDir: string;
  temperature?: number;
}

const SYSTEM_PROMPT = `You write clean, working JavaScript/HTML game code.

CRITICAL RULES:
- Output ONLY code. No explanation. No markdown fences. No \`\`\` markers.
- Write the COMPLETE file from first line to last line.
- Every function, every variable, every line must be included.
- Do NOT write "// ... unchanged" or "// rest of file" — write the ACTUAL code.
- Do NOT use void return types. This is JavaScript, not Java.
- Use requestAnimationFrame or setInterval for game loops.
- The file must be valid JavaScript that passes node --check.`;

export class FormedBuilder extends EventEmitter {
  private client: LLMClient;
  private fileTools: FileTools;
  private gameDir: string;
  private lastSyntaxError: string = '';

  constructor(config: FormedBuilderConfig) {
    super();
    this.client = config.client;
    this.fileTools = config.fileTools;
    this.gameDir = config.gameDir;
  }

  async executeStep(step: FormedBuildStep): Promise<{
    files: Record<string, string>;
    success: boolean;
    fragments: Record<string, string>;
  }> {
    const collected: Record<string, string> = {};

    for (const fragment of step.fragments) {
      this.emit('fragment_start', { id: fragment.id, question: fragment.question });

      // Build context — include existing file content for updates
      const context = this.buildContext(fragment, step);

      const response = await this.client.chat(
        this.client.buildMessages(SYSTEM_PROMPT, context),
        { onToken: (token) => this.emit('token', { agent: 'builder', token }) }
      );

      // Strip <think> blocks and markdown fences
      let code = response.content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      const fenceMatch = code.match(/```(?:javascript|js|html|css)?\n?([\s\S]*?)```/);
      if (fenceMatch) code = fenceMatch[1].trim();

      collected[fragment.id] = code;

      this.emit('fragment_done', {
        id: fragment.id,
        content: code.substring(0, 200),
        tokensOut: response.tokensOut,
        tokPerSec: response.tokensOut / (response.durationMs / 1000),
      });
    }

    // Write files with syntax validation
    let hadRollback = false;
    for (const fragment of step.fragments) {
      const code = collected[fragment.id];
      if (!code) continue;

      // Backup existing file
      let backup = '';
      try {
        backup = this.fileTools.readFile(fragment.file);
        this.fileTools.writeFile(fragment.file + '.backup', backup);
      } catch { /* new file */ }

      // Syntax check for JS files
      if (fragment.file.endsWith('.js')) {
        const syntaxOk = this.checkJsSyntax(code);
        if (!syntaxOk) {
          this.emit('fragment_done', {
            id: 'syntax-rollback',
            content: `Syntax error in ${fragment.file}: ${this.lastSyntaxError} — rolling back`,
            tokensOut: 0,
            tokPerSec: 0,
          });
          if (backup) {
            this.fileTools.writeFile(fragment.file, backup);
          }
          hadRollback = true;
          continue;
        }
      }

      this.fileTools.writeFile(fragment.file, code);
    }

    return {
      files: collected,
      success: !hadRollback && Object.keys(collected).length > 0,
      fragments: collected,
    };
  }

  /**
   * Each step = one fragment per file. Full file write every time.
   */
  async decomposeStep(step: StepDefinition): Promise<FormedBuildStep> {
    const creates = step.filesToCreate || [];
    const modifies = step.filesToModify || [];
    const allFiles = [...creates, ...modifies];

    if (allFiles.length === 0) {
      allFiles.push('game.js');
      modifies.push('game.js');
    }

    const fragments: CodeFragment[] = allFiles.map((file) => ({
      id: 'write-' + file.replace(/[\/\.]/g, '-'),
      question: step.task,
      type: (file.endsWith('.html') ? 'html' : 'full_file') as 'html' | 'full_file',
      file,
    }));

    return {
      stepId: step.stepId,
      title: step.title,
      files: allFiles,
      fragments,
      encouragement: step.encouragement,
    };
  }

  private buildContext(fragment: CodeFragment, step: FormedBuildStep): string {
    const parts: string[] = [];

    parts.push('Step: ' + step.title);
    parts.push('File: ' + fragment.file);

    // Show existing file content — model must include ALL of it plus new code
    try {
      const existing = this.fileTools.readFile(fragment.file);
      if (existing && !existing.startsWith('<!--') && existing.length > 20) {
        parts.push('\nCurrent ' + fragment.file + ' (include ALL this code plus your additions):');
        parts.push(existing);
      }
    } catch { /* new file */ }

    // Show OTHER project files so model knows what globals/functions exist
    try {
      const allFiles = this.fileTools.listFiles();
      const otherJsFiles = allFiles.filter(f =>
        f.endsWith('.js') && f !== fragment.file && !f.endsWith('.backup') && !f.includes('_meta')
      );
      if (otherJsFiles.length > 0) {
        parts.push('\nOther project files (these are loaded via <script> tags, you can use their globals):');
        for (const f of otherJsFiles) {
          try {
            const content = this.fileTools.readFile(f);
            if (content.length > 20) {
              parts.push('--- ' + f + ' ---');
              parts.push(content);
            }
          } catch { /* skip */ }
        }
      }
    } catch { /* no files yet */ }

    parts.push('\nTask: ' + fragment.question);
    parts.push('\nWrite the COMPLETE ' + fragment.file + '. Output the full file, nothing else.');

    return parts.join('\n');
  }

  private checkJsSyntax(code: string): boolean {
    const tmpFile = join(tmpdir(), 'gameforge-check-' + Date.now() + '.js');
    try {
      writeFileSync(tmpFile, code);
      execFileSync('node', ['--check', tmpFile], { stdio: 'pipe' });
      this.lastSyntaxError = '';
      return true;
    } catch (err: any) {
      this.lastSyntaxError = (err.stderr || err.message || 'Unknown').toString().substring(0, 200);
      return false;
    } finally {
      try { unlinkSync(tmpFile); } catch { /* ignore */ }
    }
  }

  getLastSyntaxError(): string {
    return this.lastSyntaxError;
  }
}
