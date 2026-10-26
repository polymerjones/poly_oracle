import Capacitor
import UIKit
import WebKit

/// The app's bridge view controller (Main.storyboard). Registers plugins that live in this app
/// target rather than in an npm package (GameCenterPlugin) and tunes the web view for a game.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(GameCenterPlugin())
    }

    /// No text-interaction gestures: kills iOS's long-press / tap-and-drag magnifier loupe over the
    /// game (CSS user-select alone doesn't stop it in WKWebView). Typing into inputs still works.
    override open func webViewConfiguration(for instanceConfiguration: InstanceConfiguration) -> WKWebViewConfiguration {
        let config = super.webViewConfiguration(for: instanceConfiguration)
        if #available(iOS 14.5, *) {
            config.preferences.isTextInteractionEnabled = false
        }
        return config
    }
}
