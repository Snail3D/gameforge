# GameForge

Autonomous multi-agent game factory powered by local LLMs on Apple Silicon.

Agents build, review, test, and iterate on HTML5 browser games — running for hours unattended.

## Quick Start

```bash
npm install
npx playwright install chromium
npm run dev -- "Make a doom-style FPS with raycasting" --mode=build
```

Dashboard opens at http://localhost:9191

## Modes

- **build** — You describe the game, AI builds it
- **dealers_choice** — AI picks the game concept
- **timed** — Build for N hours, then start a new game (`--timer=120`)
- **infinite** — Keep improving one game forever

## Architecture

```
User Prompt → Planner (GPT-oss 120B) → Build Plan
  → Builder (Gemma 4 MoE) writes code
  → Reviewer checks quality
  → Critic plays the game (vision + screenshots)
  → Ghost catches loops and answers questions
  → Repeat for each step
```

## Model Presets

```bash
# Default: GPT-oss 120B plans, Gemma 4 MoE builds (requires 128GB)
npm run dev -- "Make a game" --mode=build

# Single model: Gemma 4 MoE for everything (requires 32GB)
npm run dev -- "Make a game" --mode=build --preset=single

# E4B: Gemma 4 E4B for everything (requires 16GB)
npm run dev -- "Make a game" --mode=build --preset=e4b

# E2B: Gemma 4 E2B for everything (requires 8GB — runs on phones!)
npm run dev -- "Make a game" --mode=build --preset=e2b
```

You can also set the preset via environment variable:

```bash
MODEL_PRESET=e4b npm run dev -- "Make a game"
```

## Requirements

- Node.js 22+
- Ollama with Gemma 4 MoE (`gemma4:moe-chat`) and GPT-oss 120B (`gpt-oss:120b`)
- Playwright (`npx playwright install chromium`)
- Apple Silicon Mac recommended (tested on M5 Max 128GB)

## Dashboard

The dashboard at localhost:9191 shows:
- Live game preview (auto-reloading iframe)
- Agent chat waterfall (see all agents interact in real time)
- Feature checklist progress
- YouTube streaming mode (toggle with YT button)
- Built-in screen recording (click ⏺ to capture sessions for YouTube)

## License

MIT
