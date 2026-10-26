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
