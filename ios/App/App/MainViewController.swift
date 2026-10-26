import Capacitor
import UIKit

/// The app's bridge view controller (Main.storyboard). Exists to register plugins that live in
/// this app target rather than in an npm package — currently GameCenterPlugin.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(GameCenterPlugin())
    }
}
