import Foundation
import UIKit
import Capacitor

/// Registers for Apple Push Notification service (APNs) and hands the
/// resulting device token, and any received push, to the JS layer.
///
/// Exposed to JS under the same plugin name ("NativePush") as the two
/// Android implementations (gplay/FCM and fdroid/UnifiedPush, see
/// android/app/src/{gplay,fdroid}/java/.../push/NativePushPlugin.java), so
/// global-client/src/logic/nativePush.ts can stay platform-agnostic.
///
/// Pushes are expected to be silent (`content-available: 1`, no
/// `alert`/`sound`/`badge`) and to carry only an opaque `hub_id` — never
/// message content. This plugin never inspects or forwards anything beyond
/// that: the app treats every push purely as a "go check that hub" signal
/// and fetches real state over its own authenticated Sliding Sync channel.
@objc(NativePushPlugin)
public class NativePushPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativePushPlugin"
    public let jsName = "NativePush"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "register", returnType: CAPPluginReturnPromise)
    ]

    /// AppDelegate hands received remote notifications to this instance
    /// directly, since Capacitor core only proxies the registration
    /// callbacks (`capacitorDidRegisterForRemoteNotifications` and
    /// `capacitorDidFailToRegisterForRemoteNotifications`) via
    /// NotificationCenter, not `didReceiveRemoteNotification`.
    static weak var shared: NativePushPlugin?

    override public func load() {
        NativePushPlugin.shared = self
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(didRegister(_:)),
            name: .capacitorDidRegisterForRemoteNotifications,
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(didFailToRegister(_:)),
            name: .capacitorDidFailToRegisterForRemoteNotifications,
            object: nil
        )
    }

    @objc func register(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
            guard granted else {
                self.notifyListeners("pushUnavailable", data: ["reason": "permission_denied"])
                call.resolve()
                return
            }
            DispatchQueue.main.async {
                UIApplication.shared.registerForRemoteNotifications()
            }
            call.resolve()
        }
    }

    @objc private func didRegister(_ notification: Notification) {
        guard let deviceToken = notification.object as? Data else { return }
        let token = deviceToken.map { String(format: "%02x", $0) }.joined()
        notifyListeners("pushTokenReceived", data: ["transport": "apns", "token": token])
    }

    @objc private func didFailToRegister(_ notification: Notification) {
        notifyListeners("pushUnavailable", data: ["reason": "registration_failed"])
    }

    /// Called by `AppDelegate.application(_:didReceiveRemoteNotification:fetchCompletionHandler:)`.
    func handleRemoteNotification(
        userInfo: [AnyHashable: Any],
        completionHandler: @escaping (UIBackgroundFetchResult) -> Void
    ) {
        guard let hubId = userInfo["hub_id"] as? String else {
            completionHandler(.noData)
            return
        }
        notifyListeners("pushReceived", data: ["hub_id": hubId])
        completionHandler(.newData)
    }
}
