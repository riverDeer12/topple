import UIKit
import WebKit
import AuthenticationServices
import CryptoKit

// Sign in with Apple and with Google for the app. The result (an ID token) goes back to the
// game as `window.toppleSignedIn({provider, token, name})`, which sends it to the server
// (/api/apple, /api/google) like any other sign-in.
final class SignIn: NSObject, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding, ASWebAuthenticationPresentationContextProviding {
    static let shared = SignIn()
    weak var webView: WKWebView?
    private var googleSession: ASWebAuthenticationSession?

    func start(_ provider: String) {
        if provider == "apple" { apple() } else { google() }
    }

    private var window: ASPresentationAnchor {
        let scene = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first
        return scene?.windows.first(where: \.isKeyWindow) ?? ASPresentationAnchor()
    }
    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor { window }
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor { window }

    // MARK: Apple
    private func apple() {
        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName, .email]
        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self
        controller.performRequests()
    }
    func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let cred = authorization.credential as? ASAuthorizationAppleIDCredential,
              let data = cred.identityToken, let token = String(data: data, encoding: .utf8) else { return finish(error: "failed") }
        // Apple shares the name only on the very first sign-in.
        let name = [cred.fullName?.givenName, cred.fullName?.familyName].compactMap { $0 }.joined(separator: " ")
        finish(["provider": "apple", "token": token, "name": name])
    }
    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        finish(error: (error as? ASAuthorizationError)?.code == .canceled ? "cancel" : "failed")
    }

    // MARK: Google: OAuth 2.0 authorization code with PKCE in the system sign-in sheet
    // (Google does not allow its sign-in inside web views). Needs an iOS OAuth client
    // (GOOGLE_IOS_CLIENT_ID in project.yml).
    private func google() {
        guard let clientId = Bundle.main.object(forInfoDictionaryKey: "GoogleIOSClientID") as? String, clientId.hasSuffix(".apps.googleusercontent.com") else {
            return finish(error: "google_off")
        }
        let scheme = "com.googleusercontent.apps." + clientId.replacingOccurrences(of: ".apps.googleusercontent.com", with: "")
        let redirect = scheme + ":/oauth2redirect"
        let verifier = Self.b64url(Data((0..<32).map { _ in UInt8.random(in: 0...255) }))
        let challenge = Self.b64url(Data(SHA256.hash(data: Data(verifier.utf8))))
        var auth = URLComponents(string: "https://accounts.google.com/o/oauth2/v2/auth")!
        auth.queryItems = [
            URLQueryItem(name: "client_id", value: clientId), URLQueryItem(name: "redirect_uri", value: redirect),
            URLQueryItem(name: "response_type", value: "code"), URLQueryItem(name: "scope", value: "openid email profile"),
            URLQueryItem(name: "code_challenge", value: challenge), URLQueryItem(name: "code_challenge_method", value: "S256"),
            URLQueryItem(name: "prompt", value: "select_account"),
        ]
        let session = ASWebAuthenticationSession(url: auth.url!, callbackURLScheme: scheme) { [weak self] url, error in
            guard let self else { return }
            guard let url, let code = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.first(where: { $0.name == "code" })?.value else {
                return self.finish(error: (error as? ASWebAuthenticationSessionError)?.code == .canceledLogin ? "cancel" : "failed")
            }
            self.exchange(code: code, clientId: clientId, verifier: verifier, redirect: redirect)
        }
        session.presentationContextProvider = self
        googleSession = session
        session.start()
    }
    private func exchange(code: String, clientId: String, verifier: String, redirect: String) {
        var req = URLRequest(url: URL(string: "https://oauth2.googleapis.com/token")!)
        req.httpMethod = "POST"
        req.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        var form = URLComponents()
        form.queryItems = [
            URLQueryItem(name: "code", value: code), URLQueryItem(name: "client_id", value: clientId),
            URLQueryItem(name: "code_verifier", value: verifier), URLQueryItem(name: "redirect_uri", value: redirect),
            URLQueryItem(name: "grant_type", value: "authorization_code"),
        ]
        req.httpBody = form.percentEncodedQuery?.data(using: .utf8)
        URLSession.shared.dataTask(with: req) { [weak self] data, _, _ in
            guard let data, let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any], let idToken = json["id_token"] as? String else {
                return self?.finish(error: "failed") ?? ()
            }
            self?.finish(["provider": "google", "token": idToken])
        }.resume()
    }

    private static func b64url(_ d: Data) -> String {
        d.base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
    }
    private func finish(_ result: [String: String]? = nil, error: String? = nil) {
        DispatchQueue.main.async {
            let payload = result ?? ["error": error ?? "failed"]
            guard let data = try? JSONSerialization.data(withJSONObject: payload), let json = String(data: data, encoding: .utf8) else { return }
            self.webView?.evaluateJavaScript("window.toppleSignedIn && window.toppleSignedIn(\(json))")
        }
    }
}
