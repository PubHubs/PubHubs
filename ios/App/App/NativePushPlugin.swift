import Foundation
import UIKit
import UserNotifications
import Capacitor

/// Registers for Apple Push Notification service (APNs) and hands the
/// resulting device token, and any received push, to the JS layer.
///
/// Exposed to JS under the same plugin name ("NativePush") as the two
/// Android implementations (gplay/FCM and fdroid/UnifiedPush, see
/// android/app/src/{gplay,fdroid}/java/.../push/NativePushPlugin.java), so
/// global-client/src/logic/nativePush.ts can stay platform-agnostic.
///
/// PHC sends the pushes (pubhubs/src/servers/phc/push.rs): a generic alert from
/// this app's Localizable.strings keys, plus a random `tag` that nativePush.ts
/// maps to the hub. In the background iOS shows the alert, and tapping it opens
/// that hub; in the foreground there's no alert and the app goes to the hub.
@objc(NativePushPlugin)
public class NativePushPlugin: CAPPlugin, CAPBridgedPlugin, NotificationHandlerProtocol {
    public let identifier = "NativePushPlugin"
    public let jsName = "NativePush"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "register", returnType: CAPPluginReturnPromise)
    ]

    override public func load() {
        // Capacitor's NotificationRouter is the UNUserNotificationCenter delegate and forwards
        // remote notifications to this handler (the same hook @capacitor/push-notifications uses).
        bridge?.notificationRouter.pushNotificationHandler = self
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

    // MARK: - NotificationHandlerProtocol

    /// A push arrived while the app is in the foreground: like Android (FcmService only shows
    /// its notification when the app isn't in the foreground), don't show the alert, just tell JS.
    public func willPresent(notification: UNNotification) -> UNNotificationPresentationOptions {
        emitPushReceived(notification.request.content.userInfo)
        return []
    }

    /// The user tapped the alert: open that hub, like tapping Android's notification does.
    public func didReceive(response: UNNotificationResponse) {
        emitPushReceived(response.notification.request.content.userInfo)
    }

    private func emitPushReceived(_ userInfo: [AnyHashable: Any]) {
        guard let tag = userInfo["tag"] as? String else { return }
        // retainUntilConsumed: a tap can cold-start the app, firing before the JS layer has
        // attached its "pushReceived" listener; without this the event would be dropped instead
        // of delivered once JS is ready for it.
        notifyListeners("pushReceived", data: ["tag": tag], retainUntilConsumed: true)
    }
}
