package nl.pubhubs.client.push;

import android.Manifest;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PermissionState;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.firebase.messaging.FirebaseMessaging;

/**
 * gplay flavor: registers for push via Firebase Cloud Messaging.
 *
 * <p>Exposed to JS under the same plugin name ("NativePush") and event contract as the fdroid
 * flavor's UnifiedPush-based implementation and the iOS APNs implementation (see
 * ios/App/App/NativePushPlugin.swift), so global-client/src/logic/nativePush.ts stays platform
 * (and flavor) agnostic. Only the token/transport string differs: this flavor reports
 * {@code transport: "fcm"}.
 */
@CapacitorPlugin(
    name = "NativePush",
    permissions = {
        @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "receive")
    }
)
public class NativePushPlugin extends Plugin implements PushEventEmitter {

    @Override
    public void load() {
        super.load();
        PushEvents.setActivePlugin(this);
    }

    // PushEventEmitter - see its doc for why this indirection exists (Plugin.notifyListeners is
    // protected, so PushEvents can't call it directly on a held Plugin reference).
    @Override
    public void emitPushTokenReceived(JSObject data) {
        notifyListeners("pushTokenReceived", data);
    }

    @Override
    public void emitPushUnavailable(JSObject data) {
        notifyListeners("pushUnavailable", data);
    }

    @Override
    public void emitPushReceived(JSObject data) {
        // retainUntilConsumed: a push received right after a cold start can fire before the JS
        // layer has attached its "pushReceived" listener; without this the event would be
        // dropped instead of delivered once JS is ready. Mirrors the same fix on iOS, see
        // NativePushPlugin.swift.
        notifyListeners("pushReceived", data, true);
    }

    @PluginMethod
    public void register(PluginCall call) {
        if (getPermissionState("receive") != PermissionState.GRANTED) {
            requestPermissionForAlias("receive", call, "registerPermissionCallback");
            return;
        }
        fetchToken(call);
    }

    @PermissionCallback
    private void registerPermissionCallback(PluginCall call) {
        if (getPermissionState("receive") == PermissionState.GRANTED) {
            fetchToken(call);
        } else {
            PushEvents.notifyUnavailable("permission_denied");
            call.resolve();
        }
    }

    private void fetchToken(PluginCall call) {
        FirebaseMessaging.getInstance()
            .getToken()
            .addOnSuccessListener(token -> PushEvents.notifyTokenReceived("fcm", token))
            .addOnFailureListener(err -> PushEvents.notifyUnavailable("registration_failed"));

        // fire-and-forget from JS's perspective: the actual token arrives via the
        // "pushTokenReceived" event once Firebase's async call above completes (or
        // "pushUnavailable" if it fails), same as the fdroid/iOS implementations.
        call.resolve();
    }
}
