# Game Recipes

Pre-built step templates for common game genres. Each recipe contains the exact algorithms and code patterns that small models need to build the game reliably.

Recipes are loaded by the Planner when a matching game type is detected. The E2B model follows the recipe instead of inventing the algorithms from scratch.

## How recipes work

1. User says "make a chess game"
2. Planner detects genre: "chess" → loads `chess.json`
3. Recipe provides pre-built `buildSteps` with algorithms in the `task` field
4. E2B Builder follows the recipe step by step
5. After successful builds, recipes get refined based on session logs

## Adding new recipes

Run GameForge with `--generate-recipe` to have the system create a new recipe:
```bash
npm run dev -- "chess" --generate-recipe
```

This uses the biggest available model to plan the game once, then saves the plan as a reusable recipe.
