import UIKit
import GameKit
import UserNotifications

enum Strings {
    private static var lang: String { String(Locale.preferredLanguages.first?.prefix(2) ?? "hr") }
    static var cancel: String { ["hr": "Odustani", "it": "Annulla", "de": "Abbrechen"][lang] ?? "Cancel" }
}

// Haptic feedback for slides, landings, breaks and wins.
enum Haptics {
    static func play(_ style: String) {
        switch style {
        case "success": UINotificationFeedbackGenerator().notificationOccurred(.success)
        case "medium": UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        default: UIImpactFeedbackGenerator(style: .light).impactOccurred()
        }
    }
}

// The system share sheet for "share result".
enum Share {
    static func top() -> UIViewController? {
        let scene = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first
        var vc = scene?.windows.first(where: \.isKeyWindow)?.rootViewController
        while let next = vc?.presentedViewController { vc = next }
        return vc
    }
    static func present(text: String) {
        guard let vc = top() else { return }
        let sheet = UIActivityViewController(activityItems: [text], applicationActivities: nil)
        sheet.popoverPresentationController?.sourceView = vc.view // iPad
        sheet.popoverPresentationController?.sourceRect = CGRect(x: vc.view.bounds.midX, y: vc.view.bounds.midY, width: 0, height: 0)
        vc.present(sheet, animated: true)
    }
}

// Daily reminder as local notifications: one a day at `hour` for the next two weeks, today's
// left out once the daily puzzle is solved. The game sends this again on every launch and
// after every daily win, so the schedule always runs ahead.
enum Reminder {
    static func update(_ msg: [String: Any]) {
        let center = UNUserNotificationCenter.current()
        let ids = (0..<15).map { "daily-\($0)" }
        center.removePendingNotificationRequests(withIdentifiers: ids)
        guard msg["on"] as? Bool == true else { return }
        center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
            guard granted else { return }
            let hour = msg["hour"] as? Int ?? 17
            let solvedToday = msg["solvedToday"] as? Bool ?? false
            let cal = Calendar.current, now = Date()
            var first = true
            for (i, id) in ids.enumerated() {
                guard let day = cal.date(byAdding: .day, value: i, to: now),
                      let at = cal.date(bySettingHour: hour, minute: 0, second: 0, of: day) else { continue }
                if at <= now || (i == 0 && solvedToday) { continue }
                let content = UNMutableNotificationContent()
                content.title = msg["title"] as? String ?? "Topple"
                content.body = (first ? msg["streakBody"] : msg["body"]) as? String ?? ""
                content.sound = .default
                first = false
                let when = cal.dateComponents([.year, .month, .day, .hour, .minute], from: at)
                center.add(UNNotificationRequest(identifier: id, content: content, trigger: UNCalendarNotificationTrigger(dateMatching: when, repeats: false)))
            }
        }
    }
}

// Game Center: leaderboards for total stars and endless puzzles, and the game's achievements.
// IDs must exist in App Store Connect (see ios/README.md).
final class GameCenter {
    static let shared = GameCenter()
    private let reportedKey = "gc-reported"

    func authenticate() {
        GKLocalPlayer.local.authenticateHandler = { vc, _ in
            if let vc { Share.top()?.present(vc, animated: true) }
        }
    }

    func report(_ msg: [String: Any]) {
        guard GKLocalPlayer.local.isAuthenticated else { return }
        if let stars = msg["stars"] as? Int, stars > 0 {
            GKLeaderboard.submitScore(stars, context: 0, player: GKLocalPlayer.local, leaderboardIDs: ["topple.stars"]) { _ in }
        }
        if let endless = msg["endless"] as? Int, endless > 0 {
            GKLeaderboard.submitScore(endless, context: 0, player: GKLocalPlayer.local, leaderboardIDs: ["topple.endless"]) { _ in }
        }
        let earned = msg["achievements"] as? [String] ?? []
        var done = Set(UserDefaults.standard.stringArray(forKey: reportedKey) ?? [])
        let fresh = earned.filter { !done.contains($0) }
        guard !fresh.isEmpty else { return }
        let list = fresh.map { id -> GKAchievement in
            let a = GKAchievement(identifier: "topple.ach." + id)
            a.percentComplete = 100
            a.showsCompletionBanner = true
            return a
        }
        GKAchievement.report(list) { error in
            guard error == nil else { return }
            done.formUnion(fresh)
            UserDefaults.standard.set(Array(done), forKey: self.reportedKey)
        }
    }
}
