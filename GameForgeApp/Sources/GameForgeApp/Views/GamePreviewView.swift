import SwiftUI
import WebKit

struct GamePreviewView: NSViewRepresentable {
    let gameDir: URL?
    let reloadTrigger: Int

    func makeNSView(context: Context) -> WKWebView {
        let webView = WKWebView(frame: .zero)
        webView.underPageBackgroundColor = .clear
        return webView
    }

    func updateNSView(_ webView: WKWebView, context: Context) {
        guard let dir = gameDir else {
            if webView.url == nil {
                webView.loadHTMLString("<html><body style='background:#0a0a0a;color:#00ff88;font-family:monospace;display:flex;align-items:center;justify-content:center;height:100vh;margin:0'><div style='text-align:center;opacity:0.6'><div style='font-size:48px;margin-bottom:16px'>&#x1F528;</div><div style='font-size:20px;font-weight:bold;letter-spacing:4px'>GAMEFORGE</div><div style='font-size:12px;color:#444;margin-top:8px'>WAITING FOR GAME</div></div></body></html>", baseURL: nil)
            }
            return
        }
        let indexURL = dir.appendingPathComponent("index.html")
        guard FileManager.default.fileExists(atPath: indexURL.path) else { return }
        webView.loadFileURL(indexURL, allowingReadAccessTo: dir)
    }
}
