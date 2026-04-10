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
import { FormedBuilder } from './formed-builder.js';
import { RecipeGenerator } from '../recipes/recipe-generator.js';
import type { GameForgeConfig } from '../config.js';
import type { BuildPlan, MiniLoopResult, StepDefinition } from '../agents/types.js';
import type { GameForgeEvent, Mode } from '../logging/event-types.js';

export interface SupervisorOptions {
  config: GameForgeConfig;
  mode: Mode;
  userPrompt: string;
  timer?: number;
  useFormedBuilder?: boolean;
  useRecipeGenerator?: boolean;
  skipCritic?: boolean;  // Skip Critic visual review — pass steps after Reviewer approval only
}

export class Supervisor extends EventEmitter {
  private config: GameForgeConfig;
  private mode: Mode;
  private userPrompt: string;
  private timer: number | undefined;
  private running: boolean = false;
  private useFormedBuilder: boolean;
  private useRecipeGenerator: boolean;
  private skipCritic: boolean;

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
    this.useFormedBuilder = options.useFormedBuilder ?? false;
    this.useRecipeGenerator = options.useRecipeGenerator ?? false;
    this.skipCritic = options.skipCritic ?? false;
    this.modelManager = new ModelManager(this.config.ollama.host);
  }

  getGameDir(): string {
    return this.gameDir;
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

    // Recipe generator mode — ask atomic questions to build the plan
    if (this.useRecipeGenerator) {
      this.emitEvent({
        type: 'message',
        ts: new Date().toISOString(),
        agent: 'supervisor',
        model: 'none',
        content: 'Using Recipe Generator — building plan through atomic questions...',
        tokensIn: 0, tokensOut: 0, tokPerSec: 0,
      });

      await this.modelManager.loadModel(plannerModel);

      const generator = new RecipeGenerator({
        client: new LLMClient({ baseUrl: this.config.ollama.host, model: plannerModel }),
      });

      // Wire recipe events to dashboard
      generator.on('question', ({ num, question }) => {
        this.emitEvent({
          type: 'message',
          ts: new Date().toISOString(),
          agent: 'supervisor',
          model: 'none',
          content: `Recipe Q${num}: ${question}`,
          tokensIn: 0, tokensOut: 0, tokPerSec: 0,
        });
      });

      generator.on('answer', ({ num, answer, tokensOut, tokPerSec }) => {
        this.emitEvent({
          type: 'message',
          ts: new Date().toISOString(),
          agent: 'planner',
          model: plannerModel,
          content: answer,
          tokensIn: 0,
          tokensOut: tokensOut || 0,
          tokPerSec: tokPerSec || 0,
        });
      });

      generator.on('token', ({ agent, token }) => {
        this.emit('token', { agent, token });
      });

      const plan = await generator.generate(this.userPrompt);

      const sameModel = plannerModel === builderModel;
      if (!sameModel) {
        await this.modelManager.unloadModel(plannerModel);
      }

      // Set up game directory
      const gameName = this.extractGameName(plan.gameDesign);
      this.gameDir = join(this.config.gamesDir, gameName);
      this.metaDir = join(this.gameDir, '_meta');
      mkdirSync(this.gameDir, { recursive: true });
      mkdirSync(this.metaDir, { recursive: true });

      this.fileTools = new FileTools(this.gameDir);
      for (const [path, content] of Object.entries(plan.scaffold || {})) {
        this.fileTools.writeFile(path, content);
      }

      this.logger = new SessionLogger(this.metaDir, gameName);

      // Emit game_ready so the dashboard can load the iframe
      this.emit('game_ready', this.gameDir);

      this.emitEvent({
        type: 'message',
        ts: new Date().toISOString(),
        agent: 'supervisor',
        model: 'none',
        content: `Recipe generated: ${plan.buildSteps.length} steps, ${plan.ghost.ghostEntries.length} ghost entries`,
        tokensIn: 0, tokensOut: 0, tokPerSec: 0,
      });

      return plan;
    }

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

    const sameModel = plannerModel === builderModel;
    if (!sameModel) {
      await this.modelManager.unloadModel(plannerModel);

      this.emitEvent({
        type: 'model_swap',
        ts: new Date().toISOString(),
        agent: 'supervisor',
        model: builderModel,
        loading: builderModel,
        unloading: plannerModel,
      });
    }

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

    // Emit game_ready so the dashboard can load the iframe
    this.emit('game_ready', this.gameDir);

    return plan;
  }

  private async runBuildLoop(plan: BuildPlan): Promise<void> {
    const builderModel = this.config.ollama.models.builder;
    await this.modelManager.loadModel(builderModel);

    // Use MiniMax for Ghost smart answers if available, otherwise local scout model
    const ghostConfig = this.config.reviewer
      ? { baseUrl: this.config.reviewer.baseUrl, model: this.config.reviewer.model, apiKey: this.config.reviewer.apiKey, gameDesign: plan.gameDesign }
      : { baseUrl: this.config.ollama.host, model: this.config.ollama.models.scout, gameDesign: plan.gameDesign };
    this.ghost = new Ghost(plan.ghost as GhostDatabase, ghostConfig);
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

      const result = this.useFormedBuilder
        ? await this.executeFormedMiniLoop(step, builderClient, reviewerPrompt, criticPrompt)
        : await this.executeMiniLoop(step, builderClient, builderPrompt, reviewerPrompt, criticPrompt);

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

    // Ralph loop — never skip, keep trying until it works
    for (let attempt = 1; ; attempt++) {
      this.loopDetector!.reset();
      this.heartbeat!.ping();

      const formattedPrompt = this.miniLoop!.formatBuilderPrompt(step, criticFeedback);

      let accumulatedOutput = '';
      const builderMessages = builderClient.buildMessages(builderPrompt, formattedPrompt);
      const builderResponse = await builderClient.chat(builderMessages, {
        onToken: (token: string) => {
          accumulatedOutput += token;
          this.emit('token', { agent: 'builder', token });

          // Only check for loops every 1000 chars and only on the tail
          // to avoid false positives on normal repetitive code patterns
          if (accumulatedOutput.length % 1000 === 0 && accumulatedOutput.length > 2000) {
            const tail = accumulatedOutput.slice(-1500);
            const hasCodeBlocks = tail.includes('```');
            // Skip loop detection inside code blocks — code naturally repeats patterns
            if (!hasCodeBlocks) {
              const loopCheck = this.loopDetector!.check(tail);
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

      // Extract code from Builder response and save to game files
      const savedFiles = this.extractAndSaveCode(builderResponse.content);
      if (savedFiles.length > 0) {
        this.emitEvent({
          type: 'tool_call',
          ts: new Date().toISOString(),
          agent: 'builder',
          model: builderModel,
          tool: 'write_file',
          args: { files: savedFiles },
          result: `Saved ${savedFiles.length} file(s): ${savedFiles.join(', ')}`,
        });
      }

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
      const reviewerClient = this.config.reviewer
        ? new LLMClient({
            baseUrl: this.config.reviewer.baseUrl,
            model: this.config.reviewer.model,
            apiKey: this.config.reviewer.apiKey,
          })
        : new LLMClient({
            baseUrl: this.config.ollama.host,
            model: reviewerModel,
          });

      // Build reviewer context with actual file contents
      let reviewContext = `Review for step "${step.title}":\n\n`;
      if (savedFiles.length > 0) {
        for (const f of savedFiles) {
          try {
            const code = this.fileTools!.readFile(f);
            reviewContext += `## ${f}\n\`\`\`\n${code}\n\`\`\`\n\n`;
          } catch { /* file may not exist */ }
        }
      } else {
        reviewContext += `Builder output:\n${builderResponse.content}\n\n`;
      }
      reviewContext += `Acceptance criteria:\n${step.acceptanceCriteria.map(c => `- ${c}`).join('\n')}`;

      const reviewerMessages = reviewerClient.buildMessages(
        reviewerPrompt,
        reviewContext,
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

      const reviewResult = this.miniLoop!.parseReviewerVerdict(reviewerResponse.content);
      if (!reviewResult.passed) {
        criticFeedback = reviewerResponse.content;
        attempts.push({ attempt, criticFeedback });
        continue;
      }

      // If Reviewer fixed code inline, extract and save those fixes
      if (reviewResult.hasFixedCode) {
        const fixedFiles = this.extractAndSaveCode(reviewerResponse.content);
        if (fixedFiles.length > 0) {
          this.emitEvent({
            type: 'tool_call',
            ts: new Date().toISOString(),
            agent: 'reviewer',
            model: reviewerModel,
            tool: 'write_file',
            args: { files: fixedFiles },
            result: `Reviewer fixed ${fixedFiles.length} file(s): ${fixedFiles.join(', ')}`,
          });
        }
      }

      // If skipCritic, auto-pass after Reviewer approval
      if (this.skipCritic) {
        this.emitEvent({
          type: 'step_update',
          ts: new Date().toISOString(),
          agent: 'supervisor',
          model: builderModel,
          stepId: String(step.stepId),
          status: 'passed',
          attempt,
        });
        return { stepId: step.stepId, status: 'passed', attempts: attempt };
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

  private async executeFormedMiniLoop(
    step: StepDefinition,
    builderClient: LLMClient,
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

    const formedBuilder = new FormedBuilder({
      client: builderClient,
      fileTools: this.fileTools!,
      gameDir: this.gameDir,
      temperature: 0.2,
    });

    // Wire FormedBuilder events to dashboard
    formedBuilder.on('fragment_start', ({ id, question }: { id: string; question: string }) => {
      this.emitEvent({
        type: 'message',
        ts: new Date().toISOString(),
        agent: 'supervisor',
        model: 'none',
        content: `Fragment: ${id} — ${question}`,
        tokensIn: 0, tokensOut: 0, tokPerSec: 0,
      });
    });

    formedBuilder.on('fragment_done', ({ id, content, tokensOut, tokPerSec }: { id: string; content: string; tokensOut?: number; tokPerSec?: number }) => {
      this.emitEvent({
        type: 'message',
        ts: new Date().toISOString(),
        agent: 'builder',
        model: builderModel,
        content: `[${id}]\n${content}`,
        tokensIn: 0,
        tokensOut: tokensOut || 0,
        tokPerSec: tokPerSec || 0,
      });
    });

    formedBuilder.on('token', ({ agent, token }: { agent: string; token: string }) => {
      this.emit('token', { agent, token });
    });

    let criticFeedback: string | undefined;

    // Ralph loop — never skip, keep trying until it works
    for (let attempt = 1; ; attempt++) {
      this.heartbeat!.ping();

      // On retry, add critic feedback to the step context
      const stepWithFeedback = criticFeedback
        ? { ...step, context: `${step.context}\n\nPrevious attempt feedback: ${criticFeedback}` }
        : step;

      const formedStep = await formedBuilder.decomposeStep(stepWithFeedback);

      this.emitEvent({
        type: 'message',
        ts: new Date().toISOString(),
        agent: 'supervisor',
        model: 'none',
        content: `Decomposed into ${formedStep.fragments.length} atomic fragments`,
        tokensIn: 0, tokensOut: 0, tokPerSec: 0,
      });

      // Execute all fragments
      const result = await formedBuilder.executeStep(formedStep);

      // If syntax rollback happened, this step failed — retry with the actual error
      if (!result.success) {
        const syntaxErr = formedBuilder.getLastSyntaxError();
        criticFeedback = `SYNTAX ERROR — your code was rolled back. The error was:\n${syntaxErr}\n\nFix this and try again. Write ONLY valid JavaScript. Do not use void, do not redeclare const/let variables that already exist.`;
        continue;
      }

      // Show what files were saved
      const savedFiles = Object.keys(result.files);
      if (savedFiles.length > 0) {
        this.emitEvent({
          type: 'tool_call',
          ts: new Date().toISOString(),
          agent: 'builder',
          model: builderModel,
          tool: 'write_file',
          args: { files: savedFiles },
          result: `Saved ${savedFiles.length} file(s): ${savedFiles.join(', ')}`,
        });
      }

      // Take screenshot for Reviewer (E4B has vision)
      let screenshotImages: Array<{ base64: string; mimeType: string }> = [];
      try {
        const screenshot = await captureGameScreenshot(this.gameDir, this.metaDir, step.stepId);
        if (screenshot.base64) {
          screenshotImages = [{ base64: screenshot.base64, mimeType: 'image/png' }];
          this.emitEvent({
            type: 'screenshot',
            ts: new Date().toISOString(),
            agent: 'reviewer',
            model: reviewerModel,
            path: screenshot.path,
            base64: screenshot.base64,
            description: `Step ${step.stepId}: ${step.title}`,
          });
        }
        this.emitEvent({
          type: 'game_reload',
          ts: new Date().toISOString(),
          agent: 'supervisor',
          model: 'none',
          success: screenshot.loaded,
          consoleErrors: screenshot.errors || [],
        });
      } catch { /* screenshot failed, review code only */ }

      // Reviewer — sees code AND screenshot
      const reviewerClient = this.config.reviewer
        ? new LLMClient({
            baseUrl: this.config.reviewer.baseUrl,
            model: this.config.reviewer.model,
            apiKey: this.config.reviewer.apiKey,
          })
        : new LLMClient({
            baseUrl: this.config.ollama.host,
            model: reviewerModel,
          });

      let reviewContext = `Review for step "${step.title}":\n\n`;
      for (const [path, code] of Object.entries(result.files)) {
        reviewContext += `## ${path}\n\`\`\`\n${code}\n\`\`\`\n\n`;
      }
      reviewContext += `Acceptance criteria:\n${(step.acceptanceCriteria || []).map(c => `- ${c}`).join('\n')}`;
      if (screenshotImages.length > 0) {
        reviewContext += '\n\nA screenshot of the current game state is attached. Check if the game renders correctly.';
      }

      const reviewerMessages = reviewerClient.buildMessages(
        readFileSync(join(resolve(process.cwd(), 'src/prompts'), 'reviewer.md'), 'utf-8'),
        reviewContext,
        undefined,
        screenshotImages,
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

      const reviewResult = this.miniLoop!.parseReviewerVerdict(reviewerResponse.content);
      if (!reviewResult.passed) {
        criticFeedback = reviewerResponse.content;
        continue;
      }

      if (reviewResult.hasFixedCode) {
        const fixedFiles = this.extractAndSaveCode(reviewerResponse.content);
        if (fixedFiles.length > 0) {
          this.emitEvent({
            type: 'tool_call',
            ts: new Date().toISOString(),
            agent: 'reviewer',
            model: reviewerModel,
            tool: 'write_file',
            args: { files: fixedFiles },
            result: `Reviewer fixed ${fixedFiles.length} file(s)`,
          });
        }
      }

      // If skipCritic, auto-pass after Reviewer approval
      if (this.skipCritic) {
        this.emitEvent({
          type: 'step_update',
          ts: new Date().toISOString(),
          agent: 'supervisor',
          model: builderModel,
          stepId: String(step.stepId),
          status: 'passed',
          attempt,
        });
        return { stepId: step.stepId, status: 'passed', attempts: attempt };
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
        readFileSync(join(resolve(process.cwd(), 'src/prompts'), 'critic.md'), 'utf-8'),
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
          description: verdict.feedback.substring(0, 200),
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
        return { stepId: step.stepId, status: 'passed', attempts: attempt, criticFeedback: verdict.feedback };
      }

      criticFeedback = verdict.feedback;
    }

    // All attempts exhausted
    this.emitEvent({
      type: 'step_update',
      ts: new Date().toISOString(),
      agent: 'supervisor',
      model: builderModel,
      stepId: String(step.stepId),
      status: 'skipped',
      attempt: step.maxAttempts,
    });

    return { stepId: step.stepId, status: 'skipped', attempts: step.maxAttempts };
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

  /**
   * Extract code blocks from Builder response and save them to game files.
   * Supports formats:
   *   ```js:path/to/file.js
   *   ```javascript:path/to/file.js
   *   ```html:path/to/file.html
   *   ## File: path/to/file.js  (followed by code block)
   */
  private extractAndSaveCode(content: string): string[] {
    const savedFiles: string[] = [];
    if (!this.fileTools) return savedFiles;

    // Pattern 1: ```lang:filepath\n...code...\n```
    const codeBlockPattern = /```(?:javascript|js|html|css|json)?[:\s]+([^\n`]+)\n([\s\S]*?)```/gi;
    let match: RegExpExecArray | null;

    while ((match = codeBlockPattern.exec(content)) !== null) {
      const filePath = match[1].trim();
      const code = match[2].trim();
      if (filePath && code && filePath.includes('.')) {
        try {
          this.fileTools.writeFile(filePath, code);
          savedFiles.push(filePath);
        } catch { /* skip invalid paths */ }
      }
    }

    // Pattern 2: ## File: path/to/file.js followed by a code block
    if (savedFiles.length === 0) {
      const fileHeaderPattern = /##\s*File:\s*([^\n]+)\n\s*```[^\n]*\n([\s\S]*?)```/gi;
      while ((match = fileHeaderPattern.exec(content)) !== null) {
        const filePath = match[1].trim();
        const code = match[2].trim();
        if (filePath && code && filePath.includes('.')) {
          try {
            this.fileTools.writeFile(filePath, code);
            savedFiles.push(filePath);
          } catch { /* skip invalid paths */ }
        }
      }
    }

    // Pattern 3: If step has filesToCreate and there's only one code block, use step's filename
    if (savedFiles.length === 0) {
      const singleBlock = /```(?:javascript|js|html|css|json)?\n([\s\S]*?)```/i.exec(content);
      if (singleBlock) {
        const step = this.feeder?.currentStep();
        if (step && step.filesToCreate.length === 1) {
          const filePath = step.filesToCreate[0];
          try {
            this.fileTools.writeFile(filePath, singleBlock[1].trim());
            savedFiles.push(filePath);
          } catch { /* skip */ }
        }
      }
    }

    return savedFiles;
  }

  private parsePlanResponse(content: string): BuildPlan {
    const jsonBlockMatch = /```json\s*([\s\S]*?)```/.exec(content);
    let jsonStr = jsonBlockMatch ? jsonBlockMatch[1].trim() : content.trim();

    // Attempt JSON repair for small models that truncate or malform output
    let raw: BuildPlan;
    try {
      raw = JSON.parse(jsonStr) as BuildPlan;
    } catch {
      // Try to fix common issues: trailing commas, unclosed brackets, truncation
      jsonStr = jsonStr
        .replace(/,\s*([\]}])/g, '$1')           // Remove trailing commas
        .replace(/\n/g, ' ')                      // Flatten newlines in strings
        .replace(/[\x00-\x1f]/g, ' ');            // Remove control chars

      // If truncated, try to close open brackets/braces
      const openBraces = (jsonStr.match(/{/g) || []).length;
      const closeBraces = (jsonStr.match(/}/g) || []).length;
      const openBrackets = (jsonStr.match(/\[/g) || []).length;
      const closeBrackets = (jsonStr.match(/\]/g) || []).length;

      // Truncate to last complete object/array
      let lastValid = jsonStr.lastIndexOf('}');
      if (lastValid > 0) {
        jsonStr = jsonStr.substring(0, lastValid + 1);
      }

      // Close remaining open brackets
      for (let i = 0; i < openBrackets - closeBrackets; i++) jsonStr += ']';
      for (let i = 0; i < openBraces - closeBraces; i++) jsonStr += '}';

      // Remove trailing commas again after truncation
      jsonStr = jsonStr.replace(/,\s*([\]}])/g, '$1');

      try {
        raw = JSON.parse(jsonStr) as BuildPlan;
      } catch (e2) {
        throw new Error(`Planner output is not valid JSON even after repair. Error: ${e2}`);
      }
    }

    // Sanitize — small model planners may omit optional fields
    raw.buildSteps = (raw.buildSteps || []).map(step => ({
      ...step,
      filesToCreate: step.filesToCreate || [],
      filesToModify: step.filesToModify || [],
      acceptanceCriteria: step.acceptanceCriteria || ['Step completes without errors'],
      encouragement: step.encouragement || 'You got this!',
      maxAttempts: step.maxAttempts || 3,
      context: step.context || '',
      task: step.task || step.title || '',
    }));
    raw.features = raw.features || [];
    raw.scaffold = raw.scaffold || {};
    raw.ghost = raw.ghost || { ghostEntries: [], knownWeaknesses: [] };
    raw.ghost.ghostEntries = raw.ghost.ghostEntries || [];
    raw.ghost.knownWeaknesses = raw.ghost.knownWeaknesses || [];
    raw.gameDesign = raw.gameDesign || 'A browser game';

    return raw;
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
