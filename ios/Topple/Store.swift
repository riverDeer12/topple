import StoreKit
import WebKit

// Topple Plus: one non-consumable in-app purchase (StoreKit 2) that gives unlimited hints.
// The game asks through native({type: 'plus', action: 'status' | 'buy' | 'restore'}) and gets
// window.topplePlus({owned, price, error?, restore?}) back. Ownership comes from the App Store
// (Transaction.currentEntitlements), so it follows the Apple ID to every device.
@MainActor
final class Store {
    static let shared = Store()
    static let productId = "software.rdd.topple.plus"
    weak var webView: WKWebView?
    private var product: Product?
    private var updates: Task<Void, Never>?

    // Purchases finished outside the app (Ask to Buy, another device, refunds) arrive here.
    func start() {
        updates = Task {
            for await result in Transaction.updates {
                if case .verified(let t) = result { await t.finish() }
                await send()
            }
        }
    }

    func handle(_ action: String) {
        Task {
            switch action {
            case "buy": await buy()
            case "restore": await restore()
            default: await send()
            }
        }
    }

    private func load() async {
        if product == nil { product = try? await Product.products(for: [Self.productId]).first }
    }

    private func owned() async -> Bool {
        for await result in Transaction.currentEntitlements {
            if case .verified(let t) = result, t.productID == Self.productId, t.revocationDate == nil { return true }
        }
        return false
    }

    private func buy() async {
        await load()
        guard let product else { return await send(error: "unavailable") }
        do {
            switch try await product.purchase() {
            case .success(let verification):
                if case .verified(let t) = verification { await t.finish(); await send() } else { await send(error: "failed") }
            case .userCancelled: await send(error: "cancel")
            case .pending: await send(error: "pending")
            @unknown default: await send()
            }
        } catch {
            await send(error: "failed")
        }
    }

    private func restore() async {
        try? await AppStore.sync()
        await send(restore: true)
    }

    private func send(error: String? = nil, restore: Bool = false) async {
        await load()
        var payload: [String: Any] = ["owned": await owned(), "price": product?.displayPrice ?? ""]
        if let error { payload["error"] = error }
        if restore { payload["restore"] = true }
        guard let data = try? JSONSerialization.data(withJSONObject: payload), let json = String(data: data, encoding: .utf8) else { return }
        _ = try? await webView?.evaluateJavaScript("window.topplePlus && window.topplePlus(\(json))")
    }
}
