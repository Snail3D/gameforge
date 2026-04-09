/**
 * Recipe Generator — uses FormedSkill atomic questions to have E2B
 * build a complete game recipe step by step.
 *
 * Layer 1: Ask atomic questions about the game design
 * Layer 2: Assemble answers into a recipe (BuildPlan JSON)
 * Layer 3: E2B follows the recipe to write the code
 */

import { LLMClient } from '../llm/client.js';
import type { BuildPlan, StepDefinition } from '../agents/types.js';

export interface RecipeGeneratorConfig {
  client: LLMClient;
}

interface AtomicAnswer {
  question: string;
  answer: string;
}

const SYSTEM_PROMPT = `You are a game design expert. Answer each question with specific, concrete details. No vague answers. Include exact data structures, exact algorithms, exact values. Your answers will be used to generate code, so be precise.

Respond with ONLY the answer. No preamble, no explanation, no "here's my answer:". Just the answer.`;

export class RecipeGenerator {
  private client: LLMClient;

  constructor(config: RecipeGeneratorConfig) {
    this.client = config.client;
  }

  /**
   * Generate a complete recipe for a game type by asking atomic questions
   */
  async generate(gamePrompt: string): Promise<BuildPlan> {
    const answers: AtomicAnswer[] = [];

    const ask = async (question: string): Promise<string> => {
      const contextSoFar = answers.length > 0
        ? `\nContext from previous answers:\n${answers.map(a => `Q: ${a.question}\nA: ${a.answer}`).join('\n\n')}\n\n`
        : '';

      const response = await this.client.chat(
        this.client.buildMessages(
          SYSTEM_PROMPT,
          `Game: ${gamePrompt}\n${contextSoFar}${question}`
        )
      );

      const answer = response.content.trim();
      answers.push({ question, answer });
      return answer;
    };

    // ═══════════════════════════════════════════
    // LAYER 1: Atomic questions about game design
    // ═══════════════════════════════════════════

    // Game overview
    const gameDescription = await ask(
      'Describe this game in one paragraph: what is it, how does the player interact, what is the win/lose condition?'
    );

    // Canvas and visual setup
    const canvasSize = await ask(
      'What canvas size should this game use? Answer with just two numbers: width height (e.g., "400 400" for a square board, "800 600" for a landscape game).'
    );

    const visualStyle = await ask(
      'How should the game board/field be drawn? Describe the exact drawing steps using canvas 2D API: fillRect, strokeRect, arc, fillText, etc. Be specific about colors (hex values), coordinates, and sizes.'
    );

    // Game objects
    const gameObjects = await ask(
      'List every game object/entity type. For each one, give the exact JavaScript object structure with property names, types, and initial values. Format as: ObjectName: { prop: value, prop: value }'
    );

    // Core state
    const gameState = await ask(
      'What variables make up the complete game state? List each variable with its name, type, and initial value. Include the board/field representation, score, game phase, etc.'
    );

    // Drawing functions
    const drawingCode = await ask(
      'Write the complete drawing/rendering logic as JavaScript pseudocode. Show exactly how to draw every game element on the canvas each frame. Use ctx.fillStyle, ctx.fillRect, ctx.arc, ctx.fillText, etc. with exact coordinates and colors.'
    );

    // Input handling
    const inputHandling = await ask(
      'What inputs does the player use? For EACH input (keyboard key, mouse click, touch), describe: 1) What event to listen for, 2) What game state it changes, 3) The exact condition check. Include both desktop (keyboard/mouse) and mobile (touch/swipe) controls.'
    );

    // Game logic / update
    const gameLogic = await ask(
      'What happens in each game update tick? List every step in order: 1) What moves/changes, 2) What collision checks happen, 3) What rules are evaluated, 4) What state changes result. Include the exact algorithms with pseudocode — if/else conditions, loop logic, math formulas.'
    );

    // AI opponent (if applicable)
    const hasAI = gamePrompt.toLowerCase().includes('ai') ||
                  gamePrompt.toLowerCase().includes('computer') ||
                  gamePrompt.toLowerCase().includes('opponent') ||
                  gamePrompt.toLowerCase().includes('versus') ||
                  gamePrompt.toLowerCase().includes('chess') ||
                  gamePrompt.toLowerCase().includes('checkers');

    let aiLogic = '';
    if (hasAI) {
      aiLogic = await ask(
        'This game needs an AI opponent. Describe the COMPLETE AI algorithm step by step: 1) How does it evaluate the game state (what heuristic/scoring)? 2) How does it choose a move (random, greedy, minimax, etc.)? 3) Write the exact pseudocode for the AI decision function. Include specific values for evaluation weights.'
      );

      await ask(
        'For the AI move generation: list every type of move the AI can make, and for each move type, the exact algorithm to generate all legal moves of that type. Use array coordinates and offset patterns.'
      );
    }

    // Win/lose/scoring
    const winLoseLogic = await ask(
      'How does the game detect win, lose, and draw conditions? Write the exact check as a JavaScript if-statement with all the conditions. What happens visually when the game ends?'
    );

    // ═══════════════════════════════════════════
    // LAYER 2: Assemble answers into build steps
    // ═══════════════════════════════════════════

    const stepsPrompt = `Based on these game design answers, create a numbered list of 12-18 build steps.

Game: ${gamePrompt}
${answers.map(a => `Q: ${a.question}\nA: ${a.answer}`).join('\n\n')}

Rules for steps:
- Step 1 MUST create index.html (with canvas, dark background, viewport meta, script tag loading game.js) AND game.js (with canvas setup: getElementById, getContext, width/height constants)
- Each subsequent step adds ONE feature to game.js
- Every step must produce a visible change on screen
- Include the EXACT algorithm/code for each step in the task description — don't say "implement collision", say exactly how
- Each step modifies only game.js (except step 1 which creates both files)
- Include acceptance criteria that can be verified visually

Format each step as:
STEP N: [title]
TASK: [exact instructions with algorithms and code snippets]
FILES_CREATE: [comma separated, or "none"]
FILES_MODIFY: [comma separated, or "none"]
CRITERIA: [comma separated visual checks]`;

    const stepsResponse = await this.client.chat(
      this.client.buildMessages(
        'You create precise build step lists. Output ONLY the numbered steps in the exact format requested.',
        stepsPrompt
      )
    );

    // Parse steps into BuildPlan
    const buildSteps = this.parseSteps(stepsResponse.content);

    // ═══════════════════════════════════════════
    // LAYER 2b: Generate ghost entries
    // ═══════════════════════════════════════════

    const ghostPrompt = `Based on this game design, what are the top 5 mistakes a small AI model would make when coding this game? For each mistake:
1. Give 3-4 trigger keywords
2. Give the exact correct answer/code to prevent the mistake

Game: ${gamePrompt}
Key algorithms: ${gameLogic.substring(0, 500)}
${aiLogic ? `AI logic: ${aiLogic.substring(0, 500)}` : ''}

Format each as:
GHOST: [id]
TRIGGERS: [comma separated keywords]
RESPONSE: [exact correct answer with code]`;

    const ghostResponse = await this.client.chat(
      this.client.buildMessages(
        'You predict coding mistakes. Output ONLY the ghost entries in the exact format requested.',
        ghostPrompt
      )
    );

    const ghostEntries = this.parseGhostEntries(ghostResponse.content);

    // Assemble the BuildPlan
    const plan: BuildPlan = {
      gameDesign: gameDescription,
      buildSteps,
      features: buildSteps.map(s => ({
        id: s.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        title: s.title,
        status: 'pending' as const,
      })),
      scaffold: {
        'index.html': '<!-- Created in step 1 -->',
        'game.js': '// Created in step 1',
      },
      ghost: {
        ghostEntries,
        knownWeaknesses: [
          { id: 'no-game-loop', description: 'Forgets game loop', detection: 'missing_raf_or_interval', prevention: 'Use setInterval(gameLoop, 100) for grid games or requestAnimationFrame(gameLoop) for smooth games.' },
          { id: 'wrong-cell-size', description: 'Cell size too small', detection: 'CELL_SIZE = 1', prevention: 'Use CELL_SIZE = 20 or larger. Small cells are invisible.' },
          { id: 'no-clear', description: 'Forgets to clear canvas', detection: 'missing_clearRect', prevention: 'Always clear canvas at start of draw: ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);' },
        ],
      },
    };

    return plan;
  }

  private parseSteps(content: string): StepDefinition[] {
    const steps: StepDefinition[] = [];
    const stepBlocks = content.split(/STEP\s+\d+:/i).filter(b => b.trim());

    for (let i = 0; i < stepBlocks.length; i++) {
      const block = stepBlocks[i];

      const titleMatch = block.match(/^([^\n]+)/);
      const taskMatch = block.match(/TASK:\s*([\s\S]*?)(?=FILES_CREATE:|FILES_MODIFY:|CRITERIA:|STEP\s+\d+:|$)/i);
      const createMatch = block.match(/FILES_CREATE:\s*([^\n]+)/i);
      const modifyMatch = block.match(/FILES_MODIFY:\s*([^\n]+)/i);
      const criteriaMatch = block.match(/CRITERIA:\s*([^\n]+)/i);

      const title = titleMatch?.[1]?.trim() || `Step ${i + 1}`;
      const task = taskMatch?.[1]?.trim() || title;

      const parseFileList = (s: string | undefined): string[] => {
        if (!s || s.trim().toLowerCase() === 'none') return [];
        return s.split(',').map(f => f.trim()).filter(f => f && f !== 'none');
      };

      const filesToCreate = parseFileList(createMatch?.[1]);
      const filesToModify = parseFileList(modifyMatch?.[1]);
      const criteria = criteriaMatch?.[1]
        ? criteriaMatch[1].split(',').map(c => c.trim()).filter(Boolean)
        : ['Step completes without errors'];

      steps.push({
        stepId: i + 1,
        title,
        context: i === 0 ? 'Starting from scratch.' : `Steps 1-${i} are complete.`,
        task,
        filesToCreate,
        filesToModify,
        acceptanceCriteria: criteria,
        encouragement: i === 0 ? 'Let\'s build this!' : 'Great progress — keep it going!',
        maxAttempts: 3,
      });
    }

    return steps;
  }

  private parseGhostEntries(content: string): Array<{
    id: string;
    triggers: string[];
    context: string;
    response: string;
    prdReference: string;
  }> {
    const entries: Array<{ id: string; triggers: string[]; context: string; response: string; prdReference: string }> = [];
    const blocks = content.split(/GHOST:/i).filter(b => b.trim());

    for (const block of blocks) {
      const idMatch = block.match(/^([^\n]+)/);
      const triggersMatch = block.match(/TRIGGERS:\s*([^\n]+)/i);
      const responseMatch = block.match(/RESPONSE:\s*([\s\S]*?)(?=GHOST:|$)/i);

      if (idMatch && triggersMatch && responseMatch) {
        entries.push({
          id: idMatch[1].trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          triggers: triggersMatch[1].split(',').map(t => t.trim()),
          context: '',
          response: responseMatch[1].trim(),
          prdReference: 'recipe-generated',
        });
      }
    }

    return entries;
  }
}
