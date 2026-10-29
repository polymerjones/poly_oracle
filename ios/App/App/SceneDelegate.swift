import UIKit
import Capacitor

/// 2026-10-29: iOS 27 SDK requires the scene lifecycle (apps without it crash at launch). The window and
/// MainViewController still come from Main.storyboard (UISceneStoryboardFile in Info.plist); this only
/// forwards scene events to Capacitor and owns the per-activation audio-session fix.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }

    // Was AppDelegate.applicationDidBecomeActive — under scenes UIKit calls this instead.
    func sceneDidBecomeActive(_ scene: UIScene) {
        (UIApplication.shared.delegate as? AppDelegate)?.reactivateAudioSession()
    }
}
