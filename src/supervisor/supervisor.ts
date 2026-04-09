import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { LLMClient } from '../llm/client.js';
import type { ChatResponse } from '../llm/client.js';
import { ModelManager } from '../llm/model-manager.js';
import { SessionLogger } from '../logging/session-logger.js';
import { LoopDetector } from './loop-detector.js';
import { Ghost } from './ghost.js';
import type { GhostDatabase } from './ghost.js';
import { MiniLoop } from './mini-loop.js';
import { Heartbeat } from './heartbeat.js';
import { StepFeeder } from './step-feeder.js';
import type { StepLogEntry } from './step-feeder.js';
import { FileTools } from '../tools/file-tools.js';
import { captureGameScreenshot } from '../tools/screenshot.js';
import type { GameForgeConfig } from '../config.js';
import type { BuildPlan, MiniLoopResult, StepDefinition } from '../agents/types.js';
import type { GameForgeEvent, Mode } from '../logging/event-types.js';

export interface SupervisorOptions {
  config: GameForgeConfig;
  mode: Mode;
  userPrompt: string;
  timer?: number;
}

export class Supervisor extends EventEmitter {
  private config: GameForgeConfig;
  private mode: Mode;
  private userPrompt: string;
  private timer: number | undefined;
  private running: boolean = false;

  private logger: SessionLogger | null = null;
  private loopDetector: LoopDetector | null = null;
  private ghost: Ghost | null = null;
  private miniLoop: MiniLoop | null = null;
  private heartbeat: Heartbeat | null = null;
  private feeder: StepFeeder | null = null;
  private fileTools: FileTools | null = null;
  private modelManager: ModelManager;

  private gameDir: string = '';
  private metaDir: string = '';
  private startTime: number = 0;
  private cycles: number = 0;
  private loopsCaught: number = 0;
  private stallFiredForStep: number = -1;

  constructor(options: SupervisorOptions) {
    super();
    this.config = options.config;
    this.mode = options.mode;
    this.userPrompt = options.userPrompt;
    this.timer = options.timer;
    this.modelManager = new ModelManager(this.config.ollama.host);
  }

  async start(): Promise<void> {
    this.running = true;
    this.startTime = Date.now();

    const plan = await this.runPlanner();
    await this.runBuildLoop(plan);
  }

  stop(): void {
    this.running = false;
    if (this.heartbeat) {
      this.heartbeat.stop();
    }
    if (this.logger) {
      this.logger.close();
    }
  }

  private async runPlanner(): Promise<BuildPlan> {
    const plannerModel = this.config.ollama.models.planner;
    const builderModel = this.config.ollama.models.builder;

    this.emitEvent({
      type: 'model_swap',
      ts: new Date().toISOString(),
      agent: 'supervisor',
      model: plannerModel,
      loading: plannerModel,
    });

    await this.modelManager.loadModel(plannerModel);

    const plannerPromptPath = resolve(process.cwd(), 'src/prompts/planner.md');
    const plannerSystemPrompt = readFileSync(plannerPromptPath, 'utf-8');

    const plannerClient = new LLMClient({
      baseUrl: this.config.ollama.host,
      model: plannerModel,
    });

    const messages = plannerClient.buildMessages(plannerSystemPrompt, this.userPrompt);

    const response: ChatResponse = await plannerClient.chat(messages, {
      onToken: (token: string) => {
        this.emit('token', { agent: 'planner', token });
      },
    });

    this.emitEvent({
      type: 'message',
      ts: new Date().toISOString(),
      agent: 'planner',
      model: plannerModel,
      content: response.content,
      tokensIn: response.tokensIn,
      tokensOut: response.tokensOut,
      tokPerSec: response.tokensOut / (response.durationMs / 1000),
    });

    await this.modelManager.unloadModel(plannerModel);

    this.emitEvent({
      type: 'model_swap',
      ts: new Date().toISOString(),
      agent: 'supervisor',
      model: builderModel,
      loading: builderModel,
      unloading: plannerModel,
    });

    const plan = this.parsePlanResponse(response.content);

    const gameName = this.extractGameName(plan.gameDesign);
    this.gameDir = join(this.config.gamesDir, gameName);
    this.metaDir = join(this.gameDir, '_meta');
    mkdirSync(this.gameDir, { recursive: true });
    mkdirSync(this.metaDir, { recursive: true });

    this.fileTools = new FileTools(this.gameDir);

    for (const [filePath, content] of Object.entries(plan.scaffold)) {
      this.fileTools.writeFile(filePath, content);
    }

    this.logger = new SessionLogger(this.metaDir, gameName);

    return plan;
  }

  private async runBuildLoop(plan: BuildPlan): Promise<void> {
    const builderModel = this.config.ollama.models.builder;
    await this.modelManager.loadModel(builderModel);

    this.ghost = new Ghost(plan.ghost as GhostDatabase, {
      baseUrl: this.config.ollama.host,
      model: this.config.ollama.models.scout,  // E4B for smart answers
      gameDesign: plan.gameDesign,
    });
    this.loopDetector = new LoopDetector();
    this.miniLoop = new MiniLoop();
    this.feeder = new StepFeeder(plan.buildSteps);
    this.fileTools = this.fileTools ?? new FileTools(this.gameDir);

    this.heartbeat = new Heartbeat(120000, () => this.handleStall());
    this.heartbeat.start();

    const promptsDir = resolve(process.cwd(), 'src/prompts');
    const builderPrompt = readFileSync(join(promptsDir, 'builder.md'), 'utf-8');
    const reviewerPrompt = readFileSync(join(promptsDir, 'reviewer.md'), 'utf-8');
    const criticPrompt = readFileSync(join(promptsDir, 'critic.md'), 'utf-8');

    const builderClient = new LLMClient({
      baseUrl: this.config.ollama.host,
      model: builderModel,
    });

    while (this.running && this.feeder.hasMoreSteps()) {
      if (this.mode === 'timed' && this.timer !== undefined) {
        const elapsedMinutes = (Date.now() - this.startTime) / 60000;
        if (elapsedMinutes >= this.timer) {
          this.running = false;
          break;
        }
      }

      const step = this.feeder.currentStep();
      if (!step) break;

      const result = await this.executeMiniLoop(
        step,
        builderClient,
        builderPrompt,
        reviewerPrompt,
        criticPrompt,
      );

      const status = result.status === 'passed' ? 'passed' : 'skipped';
      this.feeder.markCompleted(step.stepId, status, [{ attempt: result.attempts }]);
      this.feeder.advance();
      this.cycles++;

      const progress = this.feeder.getProgress();
      this.emitEvent({
        type: 'system_stats',
        ts: new Date().toISOString(),
        agent: 'supervisor',
        model: builderModel,
        gpuMB: 0,
        uptimeSeconds: (Date.now() - this.startTime) / 1000,
        cycles: this.cycles,
        loopsCaught: this.loopsCaught,
        stepsCompleted: progress.completed,
        stepsTotal: progress.total,
      });
    }

    this.heartbeat.stop();
  }

  private async executeMiniLoop(
    step: StepDefinition,
    builderClient: LLMClient,
    builderPrompt: string,
    reviewerPrompt: string,
    criticPrompt: string,
  ): Promise<MiniLoopResult> {
    const builderModel = this.config.ollama.models.builder;
    const reviewerModel = this.config.ollama.models.reviewer;
    const criticModel = this.config.ollama.models.critic;

    this.emitEvent({
      type: 'step_assign',
      ts: new Date().toISOString(),
      agent: 'supervisor',
      model: builderModel,
      stepId: String(step.stepId),
      title: step.title,
    });

    let criticFeedback: string | undefined;
    const attempts: StepLogEntry['attempts'] = [];

    for (let attempt = 1; attempt <= step.maxAttempts; attempt++) {
      this.loopDetector!.reset();
      this.heartbeat!.ping();

      const formattedPrompt = this.miniLoop!.formatBuilderPrompt(step, criticFeedback);

      let accumulatedOutput = '';
      const builderMessages = builderClient.buildMessages(builderPrompt, formattedPrompt);
      const builderResponse = await builderClient.chat(builderMessages, {
        onToken: (token: string) => {
          accumulatedOutput += token;
          this.emit('token', { agent: 'builder', token });

          if (accumulatedOutput.length % 200 === 0) {
            const loopCheck = this.loopDetector!.check(accumulatedOutput);
            if (loopCheck.looping) {
              this.loopsCaught++;
              this.emitEvent({
                type: 'loop_detected',
                ts: new Date().toISOString(),
                agent: 'builder',
                model: builderModel,
                repeatedTokens: accumulatedOutput.slice(-100),
                recoveryAttempt: attempt,
              });
            }
          }
        },
      });

      this.emitEvent({
        type: 'message',
        ts: new Date().toISOString(),
        agent: 'builder',
        model: builderModel,
        content: builderResponse.content,
        tokensIn: builderResponse.tokensIn,
        tokensOut: builderResponse.tokensOut,
        tokPerSec: builderResponse.tokensOut / (builderResponse.durationMs / 1000),
      });

      // Ghost interventions — smart path uses E4B for unmatched questions
      if (this.ghost!.isQuestion(builderResponse.content)) {
        const answer = await this.ghost!.answerQuestionSmart(
          builderResponse.content,
          step.title,
        );
        this.emitEvent({
          type: 'ghost_intervention',
          ts: new Date().toISOString(),
          agent: 'ghost',
          model: answer.entryId === 'smart-ghost' ? this.config.ollama.models.scout : 'none',
          trigger: 'question',
          pattern: 'question_detected',
          response: answer.response,
          ghostEntryId: answer.entryId,
        });
      }

      const weakness = this.ghost!.checkWeakness(builderResponse.content);
      if (weakness) {
        this.emitEvent({
          type: 'ghost_intervention',
          ts: new Date().toISOString(),
          agent: 'ghost',
          model: builderModel,
          trigger: 'weakness',
          pattern: weakness.id,
          response: weakness.prevention,
        });
      }

      // Reviewer
      const reviewerClient = new LLMClient({
        baseUrl: this.config.ollama.host,
        model: reviewerModel,
      });

      const reviewerMessages = reviewerClient.buildMessages(
        reviewerPrompt,
        `Review the following code output for step "${step.title}":\n\n${builderResponse.content}\n\nAcceptance criteria:\n${step.acceptanceCriteria.map(c => `- ${c}`).join('\n')}`,
      );

      const reviewerResponse = await reviewerClient.chat(reviewerMessages);

      this.emitEvent({
        type: 'message',
        ts: new Date().toISOString(),
        agent: 'reviewer',
        model: reviewerModel,
        content: reviewerResponse.content,
        tokensIn: reviewerResponse.tokensIn,
        tokensOut: reviewerResponse.tokensOut,
        tokPerSec: reviewerResponse.tokensOut / (reviewerResponse.durationMs / 1000),
      });

      const reviewPassed = this.miniLoop!.parseReviewerVerdict(reviewerResponse.content);
      if (!reviewPassed) {
        criticFeedback = reviewerResponse.content;
        attempts.push({ attempt, criticFeedback });
        continue;
      }

      // Screenshot
      const screenshot = await captureGameScreenshot(this.gameDir, this.metaDir, step.stepId);

      this.emitEvent({
        type: 'game_reload',
        ts: new Date().toISOString(),
        agent: 'supervisor',
        model: builderModel,
        success: screenshot.loaded,
        consoleErrors: screenshot.errors,
      });

      // Critic
      const criticClient = new LLMClient({
        baseUrl: this.config.ollama.host,
        model: criticModel,
      });

      const criticUserMessage = `Review step "${step.title}" with these acceptance criteria:\n${step.acceptanceCriteria.map(c => `- ${c}`).join('\n')}\n\nProvide your verdict in format:\nVERDICT: PASS or FAIL\nREASON: <reason>\nFEATURE_UPDATES: <comma separated feature ids>`;

      const images = screenshot.base64
        ? [{ base64: screenshot.base64, mimeType: 'image/png' }]
        : [];

      const criticMessages = criticClient.buildMessages(
        criticPrompt,
        criticUserMessage,
        undefined,
        images,
      );

      const criticResponse = await criticClient.chat(criticMessages);
      const verdict = this.miniLoop!.parseCriticVerdict(criticResponse.content);

      this.emitEvent({
        type: 'message',
        ts: new Date().toISOString(),
        agent: 'critic',
        model: criticModel,
        content: criticResponse.content,
        tokensIn: criticResponse.tokensIn,
        tokensOut: criticResponse.tokensOut,
        tokPerSec: criticResponse.tokensOut / (criticResponse.durationMs / 1000),
      });

      if (screenshot.base64) {
        this.emitEvent({
          type: 'screenshot',
          ts: new Date().toISOString(),
          agent: 'critic',
          model: criticModel,
          path: screenshot.path,
          base64: screenshot.base64,
          description: `Step ${step.stepId}: ${step.title}`,
        });
      }

      this.emitEvent({
        type: 'step_update',
        ts: new Date().toISOString(),
        agent: 'supervisor',
        model: builderModel,
        stepId: String(step.stepId),
        status: verdict.passed ? 'passed' : 'failed',
        attempt,
      });

      if (verdict.passed) {
        return {
          stepId: step.stepId,
          status: 'passed',
          attempts: attempt,
          screenshot: screenshot.path,
        };
      }

      criticFeedback = verdict.feedback;
      attempts.push({ attempt, criticFeedback });
    }

    this.emitEvent({
      type: 'step_update',
      ts: new Date().toISOString(),
      agent: 'supervisor',
      model: builderModel,
      stepId: String(step.stepId),
      status: 'skipped',
      attempt: step.maxAttempts,
    });

    return {
      stepId: step.stepId,
      status: 'skipped',
      attempts: step.maxAttempts,
      criticFeedback,
    };
  }

  private handleStall(): void {
    const step = this.feeder?.currentStep();
    if (!step || !this.ghost) return;

    // Only fire stall once per step to avoid spamming
    if (this.stallFiredForStep === step.stepId) return;
    this.stallFiredForStep = step.stepId;

    const message = this.ghost.getStallMessage(
      step.title,
      step.acceptanceCriteria,
    );

    this.emitEvent({
      type: 'ghost_intervention',
      ts: new Date().toISOString(),
      agent: 'ghost',
      model: 'none',
      trigger: 'stall',
      pattern: 'heartbeat_stall',
      response: message,
    });
  }

  private parsePlanResponse(content: string): BuildPlan {
    const jsonBlockMatch = /```json\s*([\s\S]*?)```/.exec(content);
    const jsonStr = jsonBlockMatch ? jsonBlockMatch[1].trim() : content.trim();
    return JSON.parse(jsonStr) as BuildPlan;
  }

  private extractGameName(gameDesign: string): string {
    const firstLine = gameDesign.split('\n')[0] ?? 'untitled-game';
    return firstLine
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'untitled-game';
  }

  private emitEvent(event: GameForgeEvent): void {
    if (this.logger) {
      this.logger.log(event);
    }
    this.emit('event', event);
  }
}
