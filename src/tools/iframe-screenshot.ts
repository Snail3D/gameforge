// src/tools/iframe-screenshot.ts

export interface IframeScreenshotResult {
  base64: string | null;
  loaded: boolean;
  errors: Array<{ type: string; message: string }>;
}

/**
 * Request a screenshot from the dashboard's game iframe.
 * The dashboard captures via postMessage + canvas.toDataURL.
 * This function calls the dashboard's /api/screenshot endpoint.
 */
export async function captureIframeScreenshot(
  dashboardUrl: string
): Promise<IframeScreenshotResult> {
  try {
    const res = await fetch(`${dashboardUrl}/api/screenshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return { base64: null, loaded: false, errors: [{ type: 'http', message: `Dashboard returned ${res.status}` }] };
    }

    const data = await res.json() as any;
    return {
      base64: data.screenshot || null,
      loaded: !!data.screenshot,
      errors: data.errors || [],
    };
  } catch (err: any) {
    return { base64: null, loaded: false, errors: [{ type: 'fetch', message: err.message }] };
  }
}
