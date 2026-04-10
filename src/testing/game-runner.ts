import { getBrowser } from './browser.js';
import { join } from 'node:path';

export interface GameTestResult {
  loaded: boolean;
  consoleErrors: string[];
  consoleWarnings: string[];
  screenshotBase64: string;
  screenshotPath: string;
  beforeBase64?: string;  // Screenshot before actions
}

export interface GameAction {
  type: 'click' | 'key' | 'wait';
  x?: number;
  y?: number;
  key?: string;
  ms?: number;
}

export async function testGame(
  gameDir: string,
  screenshotDir: string,
  stepId: number,
  actions?: GameAction[]
): Promise<GameTestResult> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  // Set viewport to match canvas exactly
  await page.setViewportSize({ width: 400, height: 700 });

  const consoleErrors: string[] = [];
  const consoleWarnings: string[] = [];
  let loaded = true;

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
    else if (msg.type() === 'warning') consoleWarnings.push(msg.text());
  });
  page.on('pageerror', (err) => { consoleErrors.push(err.message); });

  try {
    await page.goto(`file://${gameDir}/index.html`, { waitUntil: 'networkidle', timeout: 10000 });
  } catch { loaded = false; }

  // Wait for game to render
  await page.waitForTimeout(2000);

  let beforeBase64: string | undefined;

  // Execute actions if provided
  if (actions && actions.length > 0) {
    // Take BEFORE screenshot
    const beforeBuffer = await page.screenshot();
    beforeBase64 = beforeBuffer.toString('base64');

    for (const action of actions) {
      try {
        if (action.type === 'click' && action.x !== undefined && action.y !== undefined) {
          // Move mouse first so game can detect hover, then click
          await page.mouse.move(action.x, action.y);
          await page.waitForTimeout(100);
          await page.mouse.click(action.x, action.y);
          await page.waitForTimeout(800);  // Wait longer for game to process click
        } else if (action.type === 'key' && action.key) {
          await page.keyboard.press(action.key);
          await page.waitForTimeout(500);
        } else if (action.type === 'wait' && action.ms) {
          await page.waitForTimeout(action.ms);
        }
      } catch {}
    }
    // Wait for animations/state updates
    await page.waitForTimeout(1500);
  }

  const timestamp = Date.now();
  const screenshotPath = join(screenshotDir, `step${stepId}-${timestamp}.png`);
  const buffer = await page.screenshot({ path: screenshotPath });
  const screenshotBase64 = buffer.toString('base64');

  await page.close();

  return { loaded, consoleErrors, consoleWarnings, screenshotBase64, screenshotPath, beforeBase64 };
}
