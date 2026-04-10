import SwiftUI
import WebKit

struct GamePreviewView: NSViewRepresentable {
    let gameDir: URL?
    let reloadTrigger: Int

    class Coordinator {
        var lastGameDir: URL? = nil
        var lastReloadTrigger: Int = 0
    }

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeNSView(context: Context) -> WKWebView {
        let webView = WKWebView(frame: .zero)
        webView.underPageBackgroundColor = .black
        return webView
    }

    func updateNSView(_ webView: WKWebView, context: Context) {
        let coordinator = context.coordinator

        guard let dir = gameDir else {
            if coordinator.lastGameDir != nil || webView.url == nil {
                coordinator.lastGameDir = nil
                webView.loadHTMLString("<html><body style='background:#0a0a0a;color:#00ff88;font-family:monospace;display:flex;align-items:center;justify-content:center;height:100vh;margin:0'><div style='text-align:center;opacity:0.6'><div style='font-size:48px;margin-bottom:16px'>&#x1F528;</div><div style='font-size:20px;font-weight:bold;letter-spacing:4px'>GAMEFORGE</div><div style='font-size:12px;color:#444;margin-top:8px'>WAITING FOR GAME</div></div></body></html>", baseURL: nil)
            }
            return
        }

        let indexURL = dir.appendingPathComponent("index.html")
        guard FileManager.default.fileExists(atPath: indexURL.path) else { return }

        // First load or game dir changed
        if coordinator.lastGameDir != dir {
            coordinator.lastGameDir = dir
            coordinator.lastReloadTrigger = reloadTrigger
            webView.loadFileURL(indexURL, allowingReadAccessTo: dir)
            return
        }

        // Reload triggered (file was written)
        if reloadTrigger != coordinator.lastReloadTrigger {
            coordinator.lastReloadTrigger = reloadTrigger
            // Use evaluateJavaScript to force reload — more reliable than loadFileURL
            webView.evaluateJavaScript("window.location.reload(true)") { _, error in
                if error != nil {
                    // Fallback to full load
                    webView.loadFileURL(indexURL, allowingReadAccessTo: dir)
                }
            }
        }
    }
}
