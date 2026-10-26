import Capacitor
import GameKit
import UIKit

/// Game Center for Stroids in the Polyverse (2026-10-25; ported from Monkey Trubble's GameServices).
/// JS: `Capacitor.Plugins.GameCenter` — signIn(), submitScore({ leaderboardId, score }),
/// showLeaderboard({ leaderboardId }). Scores are also kept on our own Polyverse Scoreboard; this
/// adds the native leaderboard alongside it.
@objc(GameCenterPlugin)
public class GameCenterPlugin: CAPPlugin, CAPBridgedPlugin, GKGameCenterControllerDelegate {
    public let identifier = "GameCenterPlugin"
    public let jsName = "GameCenter"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "submitScore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showLeaderboard", returnType: CAPPluginReturnPromise),
    ]

    private var pendingSignIns: [CAPPluginCall] = []
    private var handlerInstalled = false

    /// Signs the player in: the system "Welcome back" banner, or Apple's sign-in sheet the first time.
    /// Resolves { authenticated, alias }.
    @objc func signIn(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let player = GKLocalPlayer.local
            if player.isAuthenticated {
                call.resolve(["authenticated": true, "alias": player.alias])
                return
            }
            self.pendingSignIns.append(call)
            guard !self.handlerInstalled else { return }
            self.handlerInstalled = true
            player.authenticateHandler = { [weak self] viewController, error in
                DispatchQueue.main.async {
                    guard let self else { return }
                    if let viewController {
                        self.present(viewController)
                        return
                    }
                    let ok = GKLocalPlayer.local.isAuthenticated
                    let result: [String: Any] = [
                        "authenticated": ok,
                        "alias": ok ? GKLocalPlayer.local.alias : "",
                        "error": error?.localizedDescription ?? "",
                    ]
                    let calls = self.pendingSignIns
                    self.pendingSignIns.removeAll()
                    calls.forEach { $0.resolve(result) }
                }
            }
        }
    }

    @objc func submitScore(_ call: CAPPluginCall) {
        guard let id = call.getString("leaderboardId"), let score = call.getInt("score") else {
            call.reject("leaderboardId and score are required")
            return
        }
        guard GKLocalPlayer.local.isAuthenticated else {
            call.resolve(["submitted": false])
            return
        }
        GKLeaderboard.submitScore(score, context: 0, player: GKLocalPlayer.local, leaderboardIDs: [id]) { error in
            call.resolve(["submitted": error == nil, "error": error?.localizedDescription ?? ""])
        }
    }

    @objc func showLeaderboard(_ call: CAPPluginCall) {
        let id = call.getString("leaderboardId")
        DispatchQueue.main.async {
            guard GKLocalPlayer.local.isAuthenticated else {
                call.resolve(["shown": false])
                return
            }
            let vc: GKGameCenterViewController
            if let id {
                vc = GKGameCenterViewController(leaderboardID: id, playerScope: .global, timeScope: .allTime)
            } else {
                vc = GKGameCenterViewController(state: .leaderboards)
            }
            vc.gameCenterDelegate = self
            self.present(vc)
            call.resolve(["shown": true])
        }
    }

    public func gameCenterViewControllerDidFinish(_ gameCenterViewController: GKGameCenterViewController) {
        gameCenterViewController.dismiss(animated: true)
    }

    private func present(_ viewController: UIViewController) {
        var top = bridge?.viewController
        while let presented = top?.presentedViewController {
            top = presented
        }
        top?.present(viewController, animated: true)
    }
}
