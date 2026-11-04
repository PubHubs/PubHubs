import Capacitor

/// Registers the app's own plugins: Capacitor only finds plugins installed as
/// npm packages. Push is our own plugin, because Android's F-Droid build can't
/// have @capacitor/push-notifications (Firebase), and all platforms share one
/// plugin contract (see global-client/src/logic/nativePush.ts).
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(NativePushPlugin())
    }
}
