import UIKit
import WebKit

// New version in the App Store: Apple has no in-app update dialog, so at most once a day the app
// compares its version with the App Store's (iTunes lookup) and, if the store has a newer one,
// the game shows a bar (window.toppleUpdate({store: true})) whose button opens the App Store.
@MainActor enum Updates {
    static let appID = "6830289324"

    static func handle(_ action: String, webView: WKWebView?) {
        if action == "open" {
            if let url = URL(string: "itms-apps://apps.apple.com/app/id\(appID)") { UIApplication.shared.open(url) }
            return
        }
        let today = ISO8601DateFormatter.string(from: Date(), timeZone: .current, formatOptions: [.withFullDate])
        guard UserDefaults.standard.string(forKey: "updateCheckDay") != today else { return }
        guard let mine = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String,
              let bundle = Bundle.main.bundleIdentifier,
              let url = URL(string: "https://itunes.apple.com/lookup?bundleId=\(bundle)") else { return }
        Task {
            guard let (data, _) = try? await URLSession.shared.data(from: url),
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let store = (json["results"] as? [[String: Any]])?.first?["version"] as? String else { return }
            UserDefaults.standard.set(today, forKey: "updateCheckDay")
            guard newer(store, than: mine) else { return }
            _ = try? await webView?.evaluateJavaScript("window.toppleUpdate && window.toppleUpdate({store: true})")
        }
    }

    // "1.10" is newer than "1.9": compares the numbers part by part.
    static func newer(_ a: String, than b: String) -> Bool {
        let x = a.split(separator: ".").map { Int($0) ?? 0 }, y = b.split(separator: ".").map { Int($0) ?? 0 }
        for i in 0..<max(x.count, y.count) {
            let p = i < x.count ? x[i] : 0, q = i < y.count ? y[i] : 0
            if p != q { return p > q }
        }
        return false
    }
}
