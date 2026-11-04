import SwiftUI
import WebKit
import UniformTypeIdentifiers

// The game page from the app bundle, served under topple://app/ so that it has a real origin
// (local storage, web workers and requests to the Topple server all work as on the web).
struct WebGameView: UIViewRepresentable {
    static let start = URL(string: "topple://app/igra.html")!

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(BundleSchemeHandler(), forURLScheme: "topple")
        config.websiteDataStore = .default() // keeps progress between launches
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.userContentController.add(context.coordinator, name: "topple")
        // App feel: no text selection or callouts outside text fields.
        let css = "body{-webkit-user-select:none;-webkit-touch-callout:none}input,textarea{-webkit-user-select:text}"
        let js = "var s=document.createElement('style');s.textContent='\(css)';document.documentElement.appendChild(s);"
        config.userContentController.addUserScript(WKUserScript(source: js, injectionTime: .atDocumentEnd, forMainFrameOnly: true))

        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = context.coordinator
        web.uiDelegate = context.coordinator
        web.isOpaque = false
        web.backgroundColor = .clear
        web.scrollView.bounces = false
        web.scrollView.minimumZoomScale = 1
        web.scrollView.maximumZoomScale = 1
        web.scrollView.contentInsetAdjustmentBehavior = .never
        #if DEBUG
        if #available(iOS 16.4, *) { web.isInspectable = true } // Safari → Develop → your iPhone
        #endif
        context.coordinator.webView = web
        SignIn.shared.webView = web
        web.load(URLRequest(url: Self.start))
        return web
    }

    func updateUIView(_ web: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate, WKUIDelegate {
        weak var webView: WKWebView?

        // Messages from the game (see `native(...)` in web/igra.html).
        func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
            guard let msg = message.body as? [String: Any], let type = msg["type"] as? String else { return }
            switch type {
            case "haptic": Haptics.play(msg["style"] as? String ?? "light")
            case "share": Share.present(text: msg["text"] as? String ?? "")
            case "remind": Reminder.update(msg)
            case "gc": GameCenter.shared.report(msg)
            case "plus":
                let action = msg["action"] as? String ?? "status"
                let web = webView
                Task { @MainActor in Store.shared.webView = web; Store.shared.handle(action) }
            case "signin": SignIn.shared.webView = webView; SignIn.shared.start(msg["provider"] as? String ?? "apple")
            default: break
            }
        }

        // Pages of the game stay in the app; everything else (mail, the web) opens outside.
        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = action.request.url else { return decisionHandler(.cancel) }
            if url.scheme == "topple" || url.scheme == "about" || url.scheme == "blob" || url.scheme == "data" {
                return decisionHandler(.allow)
            }
            if action.targetFrame?.isMainFrame ?? true { UIApplication.shared.open(url) }
            decisionHandler(action.targetFrame == nil || action.targetFrame?.isMainFrame == true ? .cancel : .allow)
        }

        // The web content process can be ended by iOS when memory is low: reload the game.
        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { webView.reload() }

        // window.alert / confirm / prompt (used by the game, e.g. "sign out?").
        func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
            let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
            a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
            Share.top()?.present(a, animated: true) ?? completionHandler()
        }
        func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
            let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
            a.addAction(UIAlertAction(title: Strings.cancel, style: .cancel) { _ in completionHandler(false) })
            a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) })
            Share.top()?.present(a, animated: true) ?? completionHandler(false)
        }
        func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
            let a = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
            a.addTextField { $0.text = defaultText }
            a.addAction(UIAlertAction(title: Strings.cancel, style: .cancel) { _ in completionHandler(nil) })
            a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(a.textFields?.first?.text) })
            Share.top()?.present(a, animated: true) ?? completionHandler(nil)
        }
    }
}

// Serves topple://app/<path> from the "web" folder in the app bundle.
final class BundleSchemeHandler: NSObject, WKURLSchemeHandler {
    private let root = Bundle.main.resourceURL!.appendingPathComponent("web", isDirectory: true)

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url else { return }
        var path = url.path.isEmpty || url.path == "/" ? "/index.html" : url.path
        if path.hasSuffix("/") { path += "index.html" }
        let file = root.appendingPathComponent(String(path.dropFirst())).standardizedFileURL
        guard file.path.hasPrefix(root.standardizedFileURL.path), let data = try? Data(contentsOf: file) else {
            let res = HTTPURLResponse(url: url, statusCode: 404, httpVersion: "HTTP/1.1", headerFields: [:])!
            task.didReceive(res); task.didReceive(Data()); task.didFinish()
            return
        }
        let mime = UTType(filenameExtension: file.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
        let type = mime.hasPrefix("text/") || mime.hasSuffix("javascript") || mime.hasSuffix("json") ? mime + "; charset=utf-8" : mime
        let res = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1",
                                  headerFields: ["Content-Type": type, "Content-Length": String(data.count), "Cache-Control": "no-cache"])!
        task.didReceive(res)
        task.didReceive(data)
        task.didFinish()
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}
}
