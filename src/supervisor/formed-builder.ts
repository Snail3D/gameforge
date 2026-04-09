/**
 * FormedBuilder — Incremental code generation for small models.
 *
 * Instead of rewriting entire files, each step ADDS code to existing files.
 * Step 1: creates the base files
 * Step 2+: reads existing file, asks model to write ONLY the new function/code,
 *          then appends it before the final draw()/gameLoop() call.
 *
 * This prevents the "rewrite wipes good code" problem.
 */

import { LLMClient } from '../llm/client.js';
import { FileTools } from '../tools/file-tools.js';
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

const SYSTEM_FULL = 'You write clean, working JavaScript/HTML game code. Respond with ONLY the code, no explanation, no markdown fences. Output the COMPLETE file from first line to last line. The file must work standalone.';

const SYSTEM_APPEND = 'You write clean, working JavaScript game code. You are ADDING new code to an existing file. Write ONLY the new functions/variables needed for this step. Do NOT rewrite existing code. Do NOT include code that already exists. Just the new additions. No markdown fences, no explanation.';

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

      const extracted = this.extractAnswer(response.content, fragment.type);
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
        // Step 1: write complete file
        files[fileName] = collected[fileFragments[0].id] || '';
      } else if (fileFragments[0].type === 'append') {
        // Step 2+: read existing, append new code
        let existing = '';
        try { existing = this.fileTools.readFile(fileName); } catch { /* new file */ }

        const newCode = fileFragments
          .map(f => collected[f.id])
          .filter(Boolean)
          .join('\n\n');

        files[fileName] = existing ? this.insertCode(existing, newCode) : newCode;
      } else {
        files[fileName] = fileFragments
          .map(f => collected[f.id])
          .filter(Boolean)
          .join('\n\n');
      }
    }

    // Backup existing files before writing
    for (const [path, content] of Object.entries(files)) {
      try {
        const existing = this.fileTools.readFile(path);
        this.fileTools.writeFile(path + '.backup', existing);
      } catch { /* no existing file */ }
      this.fileTools.writeFile(path, content);
    }

    return { files, success: Object.keys(files).length > 0, fragments: collected };
  }

  /**
   * Decompose a step into fragments.
   * Step 1 (filesToCreate): write complete files
   * Step 2+ (filesToModify): append new code to existing files
   */
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
        question: step.task + '\n\nWrite ONLY the new code needed for this step. Do NOT rewrite existing functions. Just the new additions.',
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
   * Insert new code before the draw/gameLoop function.
   * New functions get defined before they're called.
   */
  private insertCode(existing: string, newCode: string): string {
    const insertPoints = [
      /^function\s+draw\s*\(/m,
      /^function\s+render\s*\(/m,
      /^function\s+gameLoop\s*\(/m,
      /^function\s+update\s*\(/m,
      /^\/\/\s*---\s*Game\s*Loop/im,
      /^\/\/\s*---\s*Draw/im,
      /^\/\/\s*---\s*Render/im,
    ];

    for (const pattern of insertPoints) {
      const match = pattern.exec(existing);
      if (match && match.index > 0) {
        const before = existing.substring(0, match.index);
        const after = existing.substring(match.index);
        return before + '\n// --- Added by step ---\n' + newCode + '\n\n' + after;
      }
    }

    return existing + '\n\n// --- Added by step ---\n' + newCode;
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
        parts.push('\nExisting file content (DO NOT rewrite this, only add new code):\n```\n' + existing + '\n```');
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

    if (fragment.infer_from) {
      parts.push('\nHint: ' + fragment.infer_from);
    }

    return parts.join('\n');
  }

  private extractAnswer(content: string, _type: string): string {
    let cleaned = content.trim();
    const fenceMatch = cleaned.match(/```(?:javascript|js|html|css)?\n?([\s\S]*?)```/);
    if (fenceMatch) {
      cleaned = fenceMatch[1].trim();
    }
    return cleaned;
  }

  private applyTemplate(template: string, collected: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(collected)) {
      result = result.replace(new RegExp('\\{\\{' + key + '\\}\\}', 'g'), value);
    }
    return result;
  }
}
