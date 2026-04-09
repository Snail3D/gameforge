import { testGame } from '../testing/game-runner.js';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

export async function captureGameScreenshot(
  gameDir: string,
  metaDir: string,
  stepId: number
): Promise<{ base64: string; path: string; loaded: boolean; errors: string[] }> {
  const screenshotDir = join(metaDir, 'screenshots');
  mkdirSync(screenshotDir, { recursive: true });
  const result = await testGame(gameDir, screenshotDir, stepId);
  return {
    base64: result.screenshotBase64,
    path: result.screenshotPath,
    loaded: result.loaded,
    errors: result.consoleErrors,
  };
}
