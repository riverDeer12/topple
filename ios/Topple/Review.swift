import StoreKit
import UIKit

// Apple's own "Enjoying Topple?" rating prompt, asked for by the game at good moments
// (native({type: 'review'}) in web/igra.html). Apple decides whether it really shows
// (at most three times a year per person), so the game never knows the answer.
@MainActor enum Review {
    static func ask() {
        guard let scene = UIApplication.shared.connectedScenes
            .first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene else { return }
        AppStore.requestReview(in: scene)
    }
}
