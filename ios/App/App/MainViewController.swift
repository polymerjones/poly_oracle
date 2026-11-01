import Capacitor
import UIKit
import WebKit

/// The app's bridge view controller (Main.storyboard). Registers plugins that live in this app
/// target rather than in an npm package (GameCenterPlugin) and tunes the web view for a game.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(GameCenterPlugin())
        // 2026-10-26: JS flips text interaction on while an input/textarea is in use (see
        // setNativeTextInteraction in script.js) — with it off, inputs can't be typed into.
        webView?.configuration.userContentController.add(TextInteractionToggle(owner: self), name: "textInteraction")
        // 2026-11-01: JS asks for the audio session back after a full-screen ad. Dismissing the ad's
        // view controller doesn't fire sceneDidBecomeActive, so nothing else re-asserts .playback after
        // the Google Mobile Ads SDK has managed the session (playtest: SFX gone after a Continue ad).
        webView?.configuration.userContentController.add(AudioSessionReassert(), name: "audioSession")
        // JS diagnostics (nativeLog in script.js) → stderr, so `devicectl … launch --console` shows them.
        webView?.configuration.userContentController.add(PolyLog(), name: "polyLog")
    }

    /// No text-interaction gestures by default: kills iOS's long-press / tap-and-drag magnifier
    /// loupe over the game (CSS user-select alone doesn't stop it in WKWebView). This ALSO blocks
    /// typing into inputs, so script.js re-enables it for the duration of input focus.
    override open func webViewConfiguration(for instanceConfiguration: InstanceConfiguration) -> WKWebViewConfiguration {
        let config = super.webViewConfiguration(for: instanceConfiguration)
        if #available(iOS 14.5, *) {
            config.preferences.isTextInteractionEnabled = false
        }
        return config
    }

    /// 2026-10-27: no three-finger undo/redo/copy gestures (and their "Undo" bar) — a fast multi-finger
    /// tap on the end-of-level scorecard popped the iOS Undo HUD. UIKit consults the responder chain,
    /// so returning .none here covers the web view's content view too.
    override var editingInteractionConfiguration: UIEditingInteractionConfiguration {
        return .none
    }

    fileprivate func setTextInteraction(_ on: Bool) {
        if #available(iOS 14.5, *) {
            webView?.configuration.preferences.isTextInteractionEnabled = on
        }
    }
}

/// Weak trampoline so the userContentController doesn't retain the view controller.
private final class TextInteractionToggle: NSObject, WKScriptMessageHandler {
    weak var owner: MainViewController?
    init(owner: MainViewController) { self.owner = owner }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        owner?.setTextInteraction((message.body as? Bool) ?? false)
    }
}

/// `window.webkit.messageHandlers.audioSession.postMessage("reactivate")` → AppDelegate re-asserts
/// the .playback session (and reports it back as window.__polyAudioSession for the Dev perf chip).
private final class AudioSessionReassert: NSObject, WKScriptMessageHandler {
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        (UIApplication.shared.delegate as? AppDelegate)?.reactivateAudioSession()
    }
}

private final class PolyLog: NSObject, WKScriptMessageHandler {
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        let line = "[js] \(message.body)\n"
        FileHandle.standardError.write(line.data(using: .utf8) ?? Data())
    }
}
