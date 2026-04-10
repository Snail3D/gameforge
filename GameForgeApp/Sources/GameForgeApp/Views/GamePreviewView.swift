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
            webView.loadHTMLString("<html><body style='background:#111;color:#666;font-family:monospace;display:flex;align-items:center;justify-content:center;height:100vh'><p>Waiting for game...</p></body></html>", baseURL: nil)
            return
        }
        let indexURL = dir.appendingPathComponent("index.html")
        guard FileManager.default.fileExists(atPath: indexURL.path) else { return }
        webView.loadFileURL(indexURL, allowingReadAccessTo: dir)
    }
}
