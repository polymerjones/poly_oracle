import UIKit
import Capacitor
import AVFoundation
import GoogleMobileAds

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // 2026-06-16: route audio through the "playback" category so Web Audio SFX keep playing
        // when the hardware ringer/silent switch is off. The default "ambient"/"soloAmbient"
        // category is silenced by that switch — that's why Stunt Mode had no SFX in silent mode.
        // mixWithOthers keeps other apps' audio (e.g. music) playing alongside the game.
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, options: .mixWithOthers)
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            print("AppDelegate: failed to set AVAudioSession category: \(error)")
        }
        // 2026-11-01 (playtest: SFX gone after a Continue ad): the Google Mobile Ads SDK manages the
        // AVAudioSession around a full-screen ad by default; its deactivate/reactivate froze WKWebView's
        // Web Audio clock for good (even fresh AudioContexts sat at currentTime 0). We own the session.
        MobileAds.shared.audioVideoManager.isAudioSessionApplicationManaged = true
        // 2026-10-27: no shake-to-undo "Undo" alert over the game.
        application.applicationSupportsShakeToEdit = false
        // 2026-10-26: after another app / a call / Siri takes the session, iOS doesn't hand it back on
        // its own — Web Audio in the WKWebView then stays dead (orb rub silent until reboot).
        // Re-activate when the interruption ends and whenever we become active again.
        NotificationCenter.default.addObserver(self, selector: #selector(handleAudioInterruption(_:)),
                                               name: AVAudioSession.interruptionNotification, object: nil)
        return true
    }

    func reactivateAudioSession() {
        let session = AVAudioSession.sharedInstance()
        let before = session.category.rawValue.replacingOccurrences(of: "AVAudioSessionCategory", with: "")
        var ok = true
        do {
            try session.setCategory(.playback, options: .mixWithOthers)
            try session.setActive(true)
        } catch {
            ok = false
            print("AppDelegate: failed to reactivate AVAudioSession: \(error)")
        }
        reportAudioSession(before: before, ok: ok)
    }

    // 2026-11-01: Dev perf chip readout — what the session was before we re-asserted it (the Google
    // Mobile Ads SDK manages the session around a full-screen ad and may leave it Ambient/inactive).
    private func reportAudioSession(before: String, ok: Bool) {
        let session = AVAudioSession.sharedInstance()
        let cat = session.category.rawValue.replacingOccurrences(of: "AVAudioSessionCategory", with: "")
        let js = "window.__polyAudioSession={category:'\(cat)',before:'\(before)',ok:\(ok),"
            + "otherAudio:\(session.isOtherAudioPlaying),at:Date.now()}"
        FileHandle.standardError.write("[native] session reassert before=\(before) now=\(cat) ok=\(ok) other=\(session.isOtherAudioPlaying)\n".data(using: .utf8) ?? Data())
        evaluateInWebViews(js)
    }

    private func evaluateInWebViews(_ js: String) {
        DispatchQueue.main.async {
            for scene in UIApplication.shared.connectedScenes {
                guard let windowScene = scene as? UIWindowScene else { continue }
                for win in windowScene.windows {
                    if let vc = win.rootViewController as? CAPBridgeViewController {
                        vc.bridge?.webView?.evaluateJavaScript(js, completionHandler: nil)
                    }
                }
            }
        }
    }

    @objc private func handleAudioInterruption(_ note: Notification) {
        guard let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: raw) else { return }
        if type == .ended {
            reactivateAudioSession()
            notifyWebAudioInterruptionEnded()
        }
    }

    // 2026-11-01 (playtest: alarm + snooze left the game with no music): an alarm/call banner only
    // makes the app inactive — the page never hides, so JS has no visibilitychange to recover on.
    // Tell the web side the session is back so it re-plays the music iOS paused.
    private func notifyWebAudioInterruptionEnded() {
        evaluateInWebViews("window.dispatchEvent(new Event('polyAudioInterruptionEnded'))")
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    // 2026-10-29: scene lifecycle — becoming active is now SceneDelegate.sceneDidBecomeActive,
    // which calls reactivateAudioSession().

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        return UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
