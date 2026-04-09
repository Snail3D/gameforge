// src/supervisor/formed-builder.ts

import { LLMClient, type ChatResponse } from '../llm/client.js';
import { FileTools } from '../tools/file-tools.js';
import type { StepDefinition } from '../agents/types.js';
import { EventEmitter } from 'node:events';

export interface CodeFragment {
  id: string;
  question: string;       // The atomic question to ask
  infer_from?: string;    // Hint for the model
  type: 'properties' | 'function' | 'block' | 'full_file' | 'html';
  file: string;           // Which file this fragment belongs to
  dependsOn?: string[];   // Fragment IDs that must be completed first
}

export interface FormedBuildStep {
  stepId: number;
  title: string;
  files: string[];         // Files this step produces
  fragments: CodeFragment[];  // Atomic code questions
  assemblyTemplate?: string;  // How to combine fragments into final file
  encouragement: string;
}

export interface FormedBuilderConfig {
  client: LLMClient;
  fileTools: FileTools;
  gameDir: string;
  temperature?: number;    // Low temp for deterministic code (0.1-0.3)
}

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

  /**
   * Execute a formed build step — ask atomic questions, assemble code
   */
  async executeStep(step: FormedBuildStep): Promise<{
    files: Record<string, string>;  // filename -> content
    success: boolean;
    fragments: Record<string, string>;  // fragmentId -> extracted answer
  }> {
    const collected: Record<string, string> = {};

    for (const fragment of step.fragments) {
      // Check dependencies
      if (fragment.dependsOn) {
        const missing = fragment.dependsOn.filter(id => !collected[id]);
        if (missing.length > 0) {
          this.emit('fragment_skip', { id: fragment.id, missing });
          continue;
        }
      }

      // Build minimal context
      const context = this.buildFragmentContext(fragment, collected, step);

      // Ask one atomic question
      this.emit('fragment_start', { id: fragment.id, question: fragment.question });

      const response = await this.client.chat(
        this.client.buildMessages(
          this.getSystemPrompt(fragment.type),
          context
        ),
        {
          onToken: (token) => this.emit('token', { agent: 'builder', token }),
        }
      );

      // Extract the code/answer from response
      const extracted = this.extractAnswer(response.content, fragment.type);
      collected[fragment.id] = extracted;

      this.emit('fragment_done', {
        id: fragment.id,
        content: extracted,
        tokensOut: response.tokensOut,
        tokPerSec: response.tokensOut / (response.durationMs / 1000),
      });
    }

    // Assemble fragments into complete files
    const files: Record<string, string> = {};
    for (const fileName of step.files) {
      const fileFragments = step.fragments
        .filter(f => f.file === fileName)
        .map(f => collected[f.id])
        .filter(Boolean);

      if (step.assemblyTemplate) {
        files[fileName] = this.applyTemplate(step.assemblyTemplate, collected);
      } else {
        files[fileName] = fileFragments.join('\n\n');
      }
    }

    // Write files
    for (const [path, content] of Object.entries(files)) {
      this.fileTools.writeFile(path, content);
    }

    return { files, success: Object.keys(files).length > 0, fragments: collected };
  }

  /**
   * Convert a regular StepDefinition into a FormedBuildStep.
   *
   * Strategy: ONE fragment per file. Each fragment asks for a COMPLETE file.
   * This avoids assembly bugs (duplicate declarations, missing context).
   * The model gets the full task + existing file content + algorithm hints,
   * then writes the entire file. This is what tested perfectly on E2B.
   */
  async decomposeStep(step: StepDefinition): Promise<FormedBuildStep> {
    const allFiles = [...step.filesToCreate, ...step.filesToModify];

    const fragments: CodeFragment[] = allFiles.map((file, i) => {
      // Build a focused question for this specific file
      let question = `${step.task}\n\n`;
      question += `Write the COMPLETE ${file} file. Include ALL code needed — declarations, functions, everything.\n`;
      question += `Do not write partial code. Write the full, working file from top to bottom.`;

      return {
        id: `file-${i}-${file.replace(/[\/\.]/g, '-')}`,
        question,
        type: 'full_file' as const,
        file,
        dependsOn: i > 0 ? [`file-${i - 1}-${allFiles[i - 1].replace(/[\/\.]/g, '-')}`] : undefined,
      };
    });

    return {
      stepId: step.stepId,
      title: step.title,
      files: allFiles,
      fragments,
      encouragement: step.encouragement,
    };
  }

  private buildFragmentContext(
    fragment: CodeFragment,
    collected: Record<string, string>,
    step: FormedBuildStep
  ): string {
    const parts: string[] = [];

    parts.push(`Game step: ${step.title}`);
    parts.push(`File: ${fragment.file}`);

    // Include other files already written in this step (cross-file context)
    const otherFiles = step.fragments
      .filter(f => f.file !== fragment.file && collected[f.id])
      .map(f => `// ${f.file}:\n${collected[f.id]}`);

    if (otherFiles.length > 0) {
      parts.push(`\nOther files already written in this step:\n${otherFiles.join('\n\n')}`);
    }

    // Include existing file content if modifying
    try {
      const existing = this.fileTools.readFile(fragment.file);
      if (existing && !existing.startsWith('// File:')) {
        parts.push(`\nCurrent file content:\n${existing}`);
      }
    } catch { /* file doesn't exist yet */ }

    parts.push(`\n${fragment.question}`);

    if (fragment.infer_from) {
      parts.push(`\nHint: ${fragment.infer_from}`);
    }

    return parts.join('\n');
  }

  private getSystemPrompt(type: string): string {
    const base = 'You write clean, working JavaScript/HTML game code. Respond with ONLY the code, no explanation, no markdown fences.';

    switch (type) {
      case 'properties':
        return base + ' Output only variable declarations or object properties.';
      case 'function':
        return base + ' Output only the function/method body. Keep it under 20 lines.';
      case 'block':
        return base + ' Output only the code block requested.';
      case 'html':
        return base + ' Output only the HTML requested.';
      case 'full_file':
        return base + ' Output the COMPLETE file from first line to last line. Include all imports, declarations, functions, and initialization code. The file must work standalone — do not reference variables or functions that are not defined in this file or loaded via script tags.';
      default:
        return base;
    }
  }

  private extractAnswer(content: string, _type: string): string {
    // Strip markdown fences if present
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
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
    return result;
  }
}
