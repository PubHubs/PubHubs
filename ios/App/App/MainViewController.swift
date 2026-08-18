import Capacitor

/// Subclasses the stock Capacitor bridge view controller only so we can
/// register our own native plugins (Capacitor's autolinking only covers
/// plugins installed as npm packages, not local ones like NativePushPlugin —
/// see docs/app/README.md and the push notifications plan for why push
/// isn't installed as `@capacitor/push-notifications`).
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(NativePushPlugin())
    }
}
