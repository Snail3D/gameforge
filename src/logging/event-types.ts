export type AgentName = 'planner' | 'builder' | 'reviewer' | 'critic' | 'scout' | 'ghost' | 'supervisor';
export type StepStatus = 'pending' | 'in_progress' | 'passed' | 'failed' | 'skipped';
export type Mode = 'build' | 'dealers_choice' | 'timed' | 'infinite';

interface BaseEvent {
  ts: string;
  agent: AgentName;
  model: string;
}

export interface MessageEvent extends BaseEvent {
  type: 'message';
  content: string;
  tokensIn: number;
  tokensOut: number;
  tokPerSec: number;
}

export interface ToolCallEvent extends BaseEvent {
  type: 'tool_call';
  tool: string;
  args: Record<string, unknown>;
  result: unknown;
}

export interface ScreenshotEvent extends BaseEvent {
  type: 'screenshot';
  path: string;
  base64: string;
  description: string;
}

export interface StepAssignEvent extends BaseEvent {
  type: 'step_assign';
  stepId: string;
  title: string;
}

export interface StepUpdateEvent extends BaseEvent {
  type: 'step_update';
  stepId: string;
  status: StepStatus;
  attempt: number;
}

export interface FeatureUpdateEvent extends BaseEvent {
  type: 'feature_update';
  featureId: string;
  status: StepStatus;
}

export interface GhostEvent extends BaseEvent {
  type: 'ghost_intervention';
  trigger: string;
  pattern: string;
  response: string;
  ghostEntryId?: string;
}

export interface LoopDetectedEvent extends BaseEvent {
  type: 'loop_detected';
  repeatedTokens: string;
  recoveryAttempt: number;
}

export interface GameReloadEvent extends BaseEvent {
  type: 'game_reload';
  success: boolean;
  consoleErrors: string[];
}

export interface ModelSwapEvent extends BaseEvent {
  type: 'model_swap';
  loading: string;
  unloading?: string;
}

export interface GitPushEvent extends BaseEvent {
  type: 'git_push';
  repo: string;
  commit: string;
  filesChanged: number;
}

export interface SystemStatsEvent extends BaseEvent {
  type: 'system_stats';
  gpuMB: number;
  uptimeSeconds: number;
  cycles: number;
  loopsCaught: number;
  stepsCompleted: number;
  stepsTotal: number;
}

export type GameForgeEvent =
  | MessageEvent
  | ToolCallEvent
  | ScreenshotEvent
  | StepAssignEvent
  | StepUpdateEvent
  | FeatureUpdateEvent
  | GhostEvent
  | LoopDetectedEvent
  | GameReloadEvent
  | ModelSwapEvent
  | GitPushEvent
  | SystemStatsEvent;
