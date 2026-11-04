import SwiftUI
import AVFoundation

// Topple for iOS: a native shell around the web game (../web), which ships inside the app
// and runs without internet. Native extras are in Native.swift (haptics, sharing, the daily
// reminder and Game Center); the web game asks for them through `webkit.messageHandlers.topple`.
@main
struct ToppleApp: App {
    init() {
        // Game sounds mix with the player's own music and follow the silent switch.
        try? AVAudioSession.sharedInstance().setCategory(.ambient, options: [.mixWithOthers])
        GameCenter.shared.authenticate()
        Task { @MainActor in Store.shared.start() }
    }

    var body: some Scene {
        WindowGroup {
            WebGameView()
                .background(Color("PageBackground").ignoresSafeArea())
        }
    }
}
