import { getBrowser } from './browser.js';
import { join } from 'node:path';

export interface GameTestResult {
  loaded: boolean;
  consoleErrors: string[];
  consoleWarnings: string[];
  screenshotBase64: string;
  screenshotPath: string;
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

  await page.waitForTimeout(2000);

  // Execute actions if provided
  if (actions && actions.length > 0) {
    for (const action of actions) {
      try {
        if (action.type === 'click' && action.x !== undefined && action.y !== undefined) {
          await page.mouse.click(action.x, action.y);
          await page.waitForTimeout(500);
        } else if (action.type === 'key' && action.key) {
          await page.keyboard.press(action.key);
          await page.waitForTimeout(300);
        } else if (action.type === 'wait' && action.ms) {
          await page.waitForTimeout(action.ms);
        }
      } catch {}
    }
    await page.waitForTimeout(1000);
  }

  const timestamp = Date.now();
  const screenshotPath = join(screenshotDir, `step${stepId}-${timestamp}.png`);
  const buffer = await page.screenshot({ path: screenshotPath });
  const screenshotBase64 = buffer.toString('base64');

  await page.close();

  return { loaded, consoleErrors, consoleWarnings, screenshotBase64, screenshotPath };
}
