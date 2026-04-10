import { getBrowser } from './browser.js';
import { join } from 'node:path';

export interface GameTestResult {
  loaded: boolean;
  consoleErrors: string[];
  consoleWarnings: string[];
  screenshotBase64: string;
  screenshotPath: string;
}

export async function testGame(
  gameDir: string,
  screenshotDir: string,
  stepId: number
): Promise<GameTestResult> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  const consoleErrors: string[] = [];
  const consoleWarnings: string[] = [];
  let loaded = true;

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    } else if (msg.type() === 'warning') {
      consoleWarnings.push(msg.text());
    }
  });

  page.on('pageerror', (err) => {
    consoleErrors.push(err.message);
  });

  try {
    await page.goto(`file://${gameDir}/index.html`, {
      waitUntil: 'networkidle',
      timeout: 10000,
    });
  } catch {
    loaded = false;
  }

  // Wait for game to render — canvas games need a few frames
  await page.waitForTimeout(3000);

  const timestamp = Date.now();
  const screenshotPath = join(screenshotDir, `step${stepId}-${timestamp}.png`);
  const buffer = await page.screenshot({ path: screenshotPath });
  const screenshotBase64 = buffer.toString('base64');

  await page.close();

  return {
    loaded,
    consoleErrors,
    consoleWarnings,
    screenshotBase64,
    screenshotPath,
  };
}
