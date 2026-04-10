/**
 * FormedBuilder — Incremental code generation for small models.
 *
 * Architecture:
 * - Step 1 creates index.html + game.js skeleton with section markers
 * - Step 2+ appends new code into the correct section
 * - Before appending, existing functions with same name are REPLACED, not duplicated
 * - game.js always ends with an initialization block that calls setup + draw
 */

import { LLMClient } from '../llm/client.js';
import { FileTools } from '../tools/file-tools.js';
import { execFileSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { StepDefinition } from '../agents/types.js';
import { EventEmitter } from 'node:events';

export interface CodeFragment {
  id: string;
  question: string;
  infer_from?: string;
  type: 'properties' | 'function' | 'block' | 'full_file' | 'html' | 'append';
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

const SYSTEM_FULL = 'You write clean, working JavaScript/HTML game code. Respond with ONLY the code, no explanation, no markdown fences. Output the COMPLETE file from first line to last line.';

const SYSTEM_APPEND = 'You write clean, working JavaScript game code. You are ADDING new code to an existing file. Write ONLY the new functions and variables needed. Do NOT include any functions that already exist in the file — they will be shown to you. Do NOT include canvas setup, constants, or initialization code that already exists. Just write the NEW functions. No markdown fences, no explanation, no duplicate code.';

export class FormedBuilder extends EventEmitter {
  private client: LLMClient;
  private fileTools: FileTools;
  private gameDir: string;
  private temperature: number;

  constructor(config: FormedBuilderConfig) {
    super();
    this.client = config.client;
    this.fileTools = config.fileTools;
    this.gameDir = config.gameDir;
    this.temperature = config.temperature ?? 0.2;
  }

  async executeStep(step: FormedBuildStep): Promise<{
    files: Record<string, string>;
    success: boolean;
    fragments: Record<string, string>;
  }> {
    const collected: Record<string, string> = {};

    for (const fragment of step.fragments) {
      if (fragment.dependsOn) {
        const missing = fragment.dependsOn.filter(id => !collected[id]);
        if (missing.length > 0) {
          this.emit('fragment_skip', { id: fragment.id, missing });
          continue;
        }
      }

      this.emit('fragment_start', { id: fragment.id, question: fragment.question });

      const isAppend = fragment.type === 'append';
      const systemPrompt = isAppend ? SYSTEM_APPEND : SYSTEM_FULL;
      const context = this.buildFragmentContext(fragment, collected, step);

      const response = await this.client.chat(
        this.client.buildMessages(systemPrompt, context),
        { onToken: (token) => this.emit('token', { agent: 'builder', token }) }
      );

      const extracted = this.extractAnswer(response.content);
      collected[fragment.id] = extracted;

      this.emit('fragment_done', {
        id: fragment.id,
        content: extracted.substring(0, 200),
        tokensOut: response.tokensOut,
        tokPerSec: response.tokensOut / (response.durationMs / 1000),
      });
    }

    // Write files
    const files: Record<string, string> = {};
    for (const fileName of step.files) {
      const fileFragments = step.fragments.filter(f => f.file === fileName);
      if (fileFragments.length === 0) continue;

      if (fileFragments[0].type === 'full_file' || fileFragments[0].type === 'html') {
        files[fileName] = collected[fileFragments[0].id] || '';
      } else if (fileFragments[0].type === 'append') {
        let existing = '';
        try { existing = this.fileTools.readFile(fileName); } catch { /* new file */ }

        const newCode = fileFragments
          .map(f => collected[f.id])
          .filter(Boolean)
          .join('\n\n');

        if (existing) {
          files[fileName] = this.mergeCode(existing, newCode);
        } else {
          files[fileName] = newCode;
        }
      } else {
        files[fileName] = fileFragments
          .map(f => collected[f.id])
          .filter(Boolean)
          .join('\n\n');
      }
    }

    // Backup and write with syntax validation
    let hadRollback = false;
    for (const [path, content] of Object.entries(files)) {
      let backup = '';
      try {
        backup = this.fileTools.readFile(path);
        this.fileTools.writeFile(path + '.backup', backup);
      } catch { /* no existing file */ }

      // Ensure game.js always ends with init call
      let finalContent = content;
      if (path.endsWith('.js')) {
        finalContent = this.ensureInitCall(finalContent);

        // Syntax check — if the new code has errors, rollback to backup
        const syntaxOk = this.checkJsSyntax(finalContent);
        if (!syntaxOk && backup) {
          this.emit('fragment_done', {
            id: 'syntax-rollback',
            content: `Syntax error detected in ${path} — rolling back to backup`,
            tokensOut: 0,
            tokPerSec: 0,
          });
          finalContent = backup;
          hadRollback = true;
        }
      }

      this.fileTools.writeFile(path, finalContent);
    }

    // If we rolled back, the step failed — return success: false so the Supervisor retries
    return { files, success: !hadRollback && Object.keys(files).length > 0, fragments: collected };
  }

  async decomposeStep(step: StepDefinition): Promise<FormedBuildStep> {
    const creates = step.filesToCreate || [];
    const modifies = step.filesToModify || [];
    const allFiles = [...creates, ...modifies];

    if (allFiles.length === 0) {
      allFiles.push('game.js');
      modifies.push('game.js');
    }

    const fragments: CodeFragment[] = [];

    for (const file of creates) {
      fragments.push({
        id: 'create-' + file.replace(/[\/\.]/g, '-'),
        question: step.task + '\n\nWrite the COMPLETE ' + file + ' file.',
        type: file.endsWith('.html') ? 'html' : 'full_file',
        file,
      });
    }

    for (const file of modifies) {
      fragments.push({
        id: 'append-' + file.replace(/[\/\.]/g, '-'),
        question: step.task + '\n\nWrite ONLY the new functions needed. Do NOT rewrite functions that already exist.',
        type: 'append',
        file,
      });
    }

    return {
      stepId: step.stepId,
      title: step.title,
      files: allFiles,
      fragments,
      encouragement: step.encouragement,
    };
  }

  /**
   * Merge new code into existing file.
   * - Extract function names from new code
   * - If a function already exists in the file, REPLACE it
   * - If it's new, INSERT it before the init block at the end
   * - Dedup any exact duplicate lines
   */
  private mergeCode(existing: string, newCode: string): string {
    // Extract function definitions from new code
    const newFunctions = this.extractFunctions(newCode);
    let result = existing;

    for (const { name, fullText } of newFunctions) {
      // Check if function already exists in the file
      const existingPattern = new RegExp(
        'function\\s+' + this.escapeRegex(name) + '\\s*\\([^)]*\\)\\s*\\{',
        'm'
      );
      const match = existingPattern.exec(result);

      if (match) {
        // Replace the existing function with the new one
        const start = match.index;
        const end = this.findMatchingBrace(result, start + match[0].indexOf('{'));
        if (end > start) {
          result = result.substring(0, start) + fullText + result.substring(end + 1);
        }
      } else {
        // New function — insert before the init block
        result = this.insertBeforeInit(result, fullText);
      }
    }

    // Handle non-function code (constants, variables, event listeners)
    const nonFunctionCode = this.extractNonFunctionCode(newCode);
    if (nonFunctionCode.trim()) {
      const newLines = nonFunctionCode.trim().split('\n');

      // Extract existing variable names to prevent redeclaration
      const existingVarNames = new Set<string>();
      const varPattern = /(?:const|let|var)\s+(\w+)\s*=/g;
      let varMatch;
      while ((varMatch = varPattern.exec(result)) !== null) {
        existingVarNames.add(varMatch[1]);
      }

      // Filter out lines that redeclare existing variables
      const existingLineSet = new Set(result.split('\n').map(l => l.trim()));
      const uniqueNew = newLines.filter(l => {
        const trimmed = l.trim();
        if (!trimmed) return false;
        // Exact duplicate line
        if (existingLineSet.has(trimmed)) return false;
        // Variable redeclaration (const/let/var NAME = ...)
        const declMatch = /^(?:const|let|var)\s+(\w+)\s*=/.exec(trimmed);
        if (declMatch && existingVarNames.has(declMatch[1])) return false;
        return true;
      });

      if (uniqueNew.length > 0) {
        result = this.insertBeforeInit(result, uniqueNew.join('\n'));
      }
    }

    return result;
  }

  /**
   * Extract individual function definitions from code
   */
  private extractFunctions(code: string): Array<{ name: string; fullText: string }> {
    const functions: Array<{ name: string; fullText: string }> = [];
    const pattern = /function\s+(\w+)\s*\([^)]*\)\s*\{/g;
    let match;

    while ((match = pattern.exec(code)) !== null) {
      const name = match[1];
      const start = match.index;
      const braceStart = start + match[0].indexOf('{');
      const end = this.findMatchingBrace(code, braceStart);
      if (end > start) {
        functions.push({ name, fullText: code.substring(start, end + 1) });
      }
    }

    return functions;
  }

  /**
   * Extract non-function code (constants, variable declarations, event listeners)
   */
  private extractNonFunctionCode(code: string): string {
    const functions = this.extractFunctions(code);
    let remaining = code;

    // Remove function bodies from code to get the rest
    for (const { fullText } of functions.reverse()) {
      remaining = remaining.replace(fullText, '');
    }

    // Remove comments that are just markers
    remaining = remaining.replace(/\/\/\s*---\s*Added by step\s*---/g, '');

    return remaining.trim();
  }

  /**
   * Find the matching closing brace for an opening brace
   */
  private findMatchingBrace(code: string, openPos: number): number {
    let depth = 0;
    for (let i = openPos; i < code.length; i++) {
      if (code[i] === '{') depth++;
      else if (code[i] === '}') {
        depth--;
        if (depth === 0) return i;
      }
    }
    return -1;
  }

  /**
   * Insert code before the initialization block at the end of the file.
   * The init block is identified by comments or common init patterns.
   */
  private insertBeforeInit(existing: string, newCode: string): string {
    // Look for init markers at the end of the file
    const initPatterns = [
      /\/\/\s*={3,}\s*INIT/im,
      /\/\/\s*---\s*INIT/im,
      /initializeGame\s*\(\s*\)\s*;/m,
      /drawBoard\s*\(\s*\)\s*;/m,
      /drawState\s*\(\s*\)\s*;/m,
      /gameLoop\s*\(\s*\)\s*;/m,
      /setInterval\s*\(/m,
      /requestAnimationFrame\s*\(/m,
    ];

    for (const pattern of initPatterns) {
      const match = pattern.exec(existing);
      if (match) {
        const pos = match.index;
        const before = existing.substring(0, pos);
        const after = existing.substring(pos);
        return before + '\n' + newCode + '\n\n' + after;
      }
    }

    // No init block found — append before the last line
    return existing + '\n\n' + newCode;
  }

  /**
   * Ensure game.js ends with initialization calls.
   * If no init call exists at the bottom, add one.
   */
  private ensureInitCall(code: string): string {
    const lines = code.trimEnd().split('\n');
    const lastLines = lines.slice(-5).join('\n');

    // Check if there's already an init call near the end
    const hasInit = /initializeGame\s*\(\)|drawBoard\s*\(\)|drawState\s*\(\)|gameLoop\s*\(\)|setInterval|requestAnimationFrame/.test(lastLines);

    if (hasInit) return code;

    // Find what init functions exist in the code
    const initCalls: string[] = [];
    if (/function\s+initializeGame\s*\(/.test(code)) initCalls.push('initializeGame();');
    if (/function\s+setupGame\s*\(/.test(code)) initCalls.push('setupGame();');
    if (/function\s+init\s*\(/.test(code)) initCalls.push('init();');
    if (/function\s+drawBoard\s*\(/.test(code)) initCalls.push('drawBoard();');
    if (/function\s+drawState\s*\(/.test(code)) initCalls.push('drawState();');
    if (/function\s+draw\s*\(/.test(code)) initCalls.push('draw();');
    if (/function\s+render\s*\(/.test(code)) initCalls.push('render();');

    if (initCalls.length === 0) return code;

    return code + '\n\n// === START GAME ===\n' + initCalls.join('\n') + '\n';
  }

  private buildFragmentContext(
    fragment: CodeFragment,
    collected: Record<string, string>,
    step: FormedBuildStep
  ): string {
    const parts: string[] = [];

    parts.push('Game step: ' + step.title);
    parts.push('File: ' + fragment.file);

    if (fragment.type === 'append') {
      try {
        const existing = this.fileTools.readFile(fragment.file);

        // Show existing function names so the model knows what NOT to rewrite
        const existingFuncs = this.extractFunctions(existing).map(f => f.name);
        if (existingFuncs.length > 0) {
          parts.push('\nFunctions that ALREADY EXIST (do NOT rewrite these): ' + existingFuncs.join(', '));
        }

        parts.push('\nCurrent file content:\n```\n' + existing + '\n```');
      } catch {
        parts.push('\nFile does not exist yet.');
      }
    }

    const otherFiles = step.fragments
      .filter(f => f.file !== fragment.file && collected[f.id])
      .map(f => '// ' + f.file + ':\n' + collected[f.id]);

    if (otherFiles.length > 0) {
      parts.push('\nOther files:\n' + otherFiles.join('\n\n'));
    }

    parts.push('\n' + fragment.question);

    return parts.join('\n');
  }

  private extractAnswer(content: string): string {
    let cleaned = content.trim();
    const fenceMatch = cleaned.match(/```(?:javascript|js|html|css)?\n?([\s\S]*?)```/);
    if (fenceMatch) {
      cleaned = fenceMatch[1].trim();
    }
    return cleaned;
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Check JS syntax using Node's --check flag.
   * Writes to a temp file, runs node --check, returns true if valid.
   */
  private checkJsSyntax(code: string): boolean {
    const tmpFile = join(tmpdir(), 'gameforge-syntax-check-' + Date.now() + '.js');
    try {
      writeFileSync(tmpFile, code);
      execFileSync('node', ['--check', tmpFile], { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    } finally {
      try { unlinkSync(tmpFile); } catch { /* ignore */ }
    }
  }
}
