import SwiftUI
import WebKit

struct GamePreviewView: NSViewRepresentable {
    let gameDir: URL?
    let reloadTrigger: Int

    func makeNSView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.setValue(false, forKey: "drawsBackground") // Transparent bg
        return webView
    }

    func updateNSView(_ webView: WKWebView, context: Context) {
        guard let dir = gameDir else {
            webView.loadHTMLString(emptyStateHTML, baseURL: nil)
            return
        }
        let indexURL = dir.appendingPathComponent("index.html")
        guard FileManager.default.fileExists(atPath: indexURL.path) else {
            webView.loadHTMLString(loadingStateHTML, baseURL: nil)
            return
        }
        webView.loadFileURL(indexURL, allowingReadAccessTo: dir)
    }

    private var emptyStateHTML: String {
        """
        <html>
        <body style="
            background: #0a0a0a;
            color: #00ff88;
            font-family: 'SF Mono', 'Menlo', monospace;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            flex-direction: column;
        ">
            <div style="text-align: center; opacity: 0.6;">
                <div style="font-size: 48px; margin-bottom: 16px;">&#x1F528;</div>
                <div style="font-size: 20px; font-weight: bold; letter-spacing: 4px; margin-bottom: 8px;">GAMEFORGE</div>
                <div style="font-size: 12px; color: #444; letter-spacing: 2px;">WAITING FOR GAME</div>
                <div style="margin-top: 24px; width: 60px; height: 2px; background: linear-gradient(90deg, transparent, #00ff88, transparent); animation: pulse 2s ease-in-out infinite;"></div>
            </div>
            <style>
                @keyframes pulse { 0%,100% { opacity: 0.3; } 50% { opacity: 1; } }
            </style>
        </body>
        </html>
        """
    }

    private var loadingStateHTML: String {
        """
        <html>
        <body style="
            background: #0a0a0a;
            color: #00ff88;
            font-family: 'SF Mono', 'Menlo', monospace;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            flex-direction: column;
        ">
            <div style="text-align: center;">
                <div style="font-size: 14px; letter-spacing: 2px; margin-bottom: 16px; opacity: 0.7;">BUILDING GAME...</div>
                <div style="width: 120px; height: 2px; background: #111; border-radius: 1px; overflow: hidden;">
                    <div style="width: 40%; height: 100%; background: #00ff88; animation: load 1.5s ease-in-out infinite;"></div>
                </div>
            </div>
            <style>
                @keyframes load { 0% { margin-left: -40%; } 100% { margin-left: 100%; } }
            </style>
        </body>
        </html>
        """
    }
}
