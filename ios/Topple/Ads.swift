import UIKit
import WebKit
import AppTrackingTransparency
import GoogleMobileAds
import UserMessagingPlatform

// Rewarded ads for hints (AdMob), the same as in the Android app (android/.../Ads.kt).
// The game asks through native({type: 'ad', action: 'status' | 'load' | 'show' | 'privacy'}) and
// gets window.toppleAds({ready, loading, privacy, result?}) back; result is 'rewarded' (watched to
// the end: one hint), 'dismissed' or 'none'. Before any ad: Google's consent form for the EU/UK
// (User Messaging Platform), then Apple's tracking question (App Tracking Transparency).
// IDs come from Info.plist (project.yml: ADMOB_APP_ID, ADMOB_REWARDED_ID).
@MainActor
final class Ads: NSObject, FullScreenContentDelegate {
    static let shared = Ads()
    weak var webView: WKWebView?
    private var ad: RewardedAd?
    private var loading = false
    private var consentAsked = false
    private var started = false
    private var earned = false
    private var unitID: String { Bundle.main.object(forInfoDictionaryKey: "ToppleRewardedAdUnit") as? String ?? "" }

    func handle(_ action: String) {
        switch action {
        case "load": started ? load() : askConsent()
        case "show": show()
        case "privacy":
            guard let vc = Share.top() else { return send() }
            ConsentForm.presentPrivacyOptionsForm(from: vc) { _ in
                Task { @MainActor in self.afterConsent() }
            }
        default: askConsent() // the game's first status request, once its page is up
        }
        send()
    }

    // Google's consent form (shown only where the law asks for it), once per launch.
    private func askConsent() {
        guard !consentAsked else { return }
        consentAsked = true
        ConsentInformation.shared.requestConsentInfoUpdate(with: RequestParameters()) { _ in
            Task { @MainActor in
                guard let vc = Share.top() else { return self.afterConsent() }
                ConsentForm.loadAndPresentIfRequired(from: vc) { _ in
                    Task { @MainActor in self.afterConsent() }
                }
            }
        }
    }

    private func afterConsent() {
        guard ConsentInformation.shared.canRequestAds else { return send() }
        if started { return load() }
        started = true
        // Apple's question whether ads may use the device's advertising identifier.
        ATTrackingManager.requestTrackingAuthorization { _ in
            Task { @MainActor in
                MobileAds.shared.start(completionHandler: nil)
                self.load()
            }
        }
    }

    private func load() {
        guard ad == nil, !loading, started, !unitID.isEmpty else { return send() }
        loading = true
        send()
        RewardedAd.load(with: unitID, request: Request()) { loaded, _ in
            Task { @MainActor in
                self.loading = false
                self.ad = loaded
                loaded?.fullScreenContentDelegate = self
                self.send()
            }
        }
    }

    private func show() {
        guard let current = ad, let vc = Share.top() else { return send("none") }
        ad = nil
        earned = false
        current.present(from: vc) {
            Task { @MainActor in self.earned = true }
        }
    }

    nonisolated func adDidDismissFullScreenContent(_ ad: FullScreenPresentingAd) {
        Task { @MainActor in
            self.send(self.earned ? "rewarded" : "dismissed")
            self.load()
        }
    }

    nonisolated func ad(_ ad: FullScreenPresentingAd, didFailToPresentFullScreenContentWithError error: Error) {
        Task { @MainActor in
            self.send("none")
            self.load()
        }
    }

    private func send(_ result: String? = nil) {
        var payload: [String: Any] = [
            "ready": ad != nil,
            "loading": loading,
            "privacy": ConsentInformation.shared.privacyOptionsRequirementStatus == .required,
        ]
        if let result { payload["result"] = result }
        guard let data = try? JSONSerialization.data(withJSONObject: payload), let json = String(data: data, encoding: .utf8) else { return }
        webView?.evaluateJavaScript("window.toppleAds && window.toppleAds(\(json))")
    }
}
