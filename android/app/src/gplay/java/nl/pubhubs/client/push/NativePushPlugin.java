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
public class NativePushPlugin extends Plugin {

    @Override
    public void load() {
        super.load();
        PushEvents.setActivePlugin(this);
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
            .addOnSuccessListener(token -> {
                JSObject data = new JSObject();
                data.put("transport", "fcm");
                data.put("token", token);
                notifyListeners("pushTokenReceived", data);
            })
            .addOnFailureListener(err -> PushEvents.notifyUnavailable("registration_failed"));

        // fire-and-forget from JS's perspective: the actual token arrives via the
        // "pushTokenReceived" event once Firebase's async call above completes (or
        // "pushUnavailable" if it fails), same as the fdroid/iOS implementations.
        call.resolve();
    }
}
