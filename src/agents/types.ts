// src/agents/types.ts

import type { AgentName } from '../logging/event-types.js';

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description: string }>;
  execute: (args: Record<string, string>) => Promise<string>;
}

export interface AgentConfig {
  name: AgentName;
  model: string;
  systemPrompt: string;
  tools?: ToolDefinition[];
  temperature?: number;
}

export interface AgentResponse {
  content: string;
  toolCalls: Array<{ tool: string; args: Record<string, unknown>; result: string }>;
  tokensIn: number;
  tokensOut: number;
  tokPerSec: number;
}

export interface StepDefinition {
  stepId: number;
  title: string;
  context: string;
  task: string;
  filesToModify: string[];
  filesToCreate: string[];
  acceptanceCriteria: string[];
  encouragement: string;
  maxAttempts: number;
}

export interface BuildPlan {
  gameDesign: string;
  buildSteps: StepDefinition[];
  features: FeatureItem[];
  scaffold: Record<string, string>; // path -> initial content with comment headers
  ghost: {
    ghostEntries: Array<{
      id: string;
      triggers: string[];
      context: string;
      response: string;
      prdReference: string;
    }>;
    knownWeaknesses: Array<{
      id: string;
      description: string;
      detection: string;
      prevention: string;
    }>;
  };
}

export interface FeatureItem {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'done' | 'removed';
}

export interface MiniLoopResult {
  stepId: number;
  status: 'passed' | 'failed' | 'skipped';
  attempts: number;
  criticFeedback?: string;
  screenshot?: string;
}
