import SwiftUI
import WebKit

struct GamePreviewView: NSViewRepresentable {
    let gameDir: URL?
    let reloadTrigger: Int

    class Coordinator {
        var lastReloadTrigger: Int = -1
        var hasLoadedGame = false
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeNSView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .nonPersistent()
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.underPageBackgroundColor = .black
        return webView
    }

    func updateNSView(_ webView: WKWebView, context: Context) {
        let c = context.coordinator

        guard gameDir != nil else {
            if c.hasLoadedGame || c.lastReloadTrigger == -1 {
                c.hasLoadedGame = false
                c.lastReloadTrigger = 0
                webView.loadHTMLString("<html><body style='background:#0a0a0a;color:#00ff88;font-family:monospace;display:flex;align-items:center;justify-content:center;height:100vh;margin:0'><div style='text-align:center;opacity:0.6'><div style='font-size:48px;margin-bottom:16px'>&#x1F528;</div><div style='font-size:20px;font-weight:bold;letter-spacing:4px'>GAMEFORGE</div><div style='font-size:12px;color:#444;margin-top:8px'>WAITING FOR GAME</div></div></body></html>", baseURL: nil)
            }
            return
        }

        // Load game via HTTP — the Express server serves it at /game/
        // This avoids all file:// caching and permission issues
        if reloadTrigger != c.lastReloadTrigger || !c.hasLoadedGame {
            c.lastReloadTrigger = reloadTrigger
            c.hasLoadedGame = true
            let gameURL = URL(string: "http://localhost:9191/game/index.html?t=\(Date().timeIntervalSince1970)")!
            webView.load(URLRequest(url: gameURL))
        }
    }
}
