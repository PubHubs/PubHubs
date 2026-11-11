package nl.pubhubs.client.push;

import android.Manifest;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.firebase.messaging.FirebaseMessaging;

/**
 * gplay build: push notifications through Firebase Cloud Messaging.
 *
 * <p>Same plugin name and events as the fdroid build's UnifiedPush plugin and iOS's
 * NativePushPlugin.swift, see global-client/src/logic/nativePush.ts.
 */
@CapacitorPlugin(
    name = "NativePush",
    permissions = {
        @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "receive")
    }
)
public class NativePushPlugin extends Plugin implements PushEventEmitter {

    private static final String TAG = "NativePushPlugin";

    @Override
    public void load() {
        super.load();
        PushEvents.setActivePlugin(this);
    }

    @Override
    public void emitPushTokenReceived(JSObject data) {
        notifyListeners("pushTokenReceived", data);
    }

    @Override
    public void emitPushUnavailable(JSObject data) {
        notifyListeners("pushUnavailable", data);
    }

    @Override
    public void emitPushTapped(JSObject data) {
        // Retained: a tap can start the app before JS listens.
        notifyListeners("pushTapped", data, true);
    }

    /** Asks for permission, then reports the token through "pushTokenReceived". Always resolves. */
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
        try {
            FirebaseMessaging.getInstance()
                .getToken()
                .addOnSuccessListener(token -> PushEvents.notifyTokenReceived("fcm", token, null))
                .addOnFailureListener(err -> {
                    Log.e(TAG, "FirebaseMessaging.getToken() failed", err);
                    PushEvents.notifyUnavailable("registration_failed");
                });
        } catch (IllegalStateException e) {
            // No google-services.json in this build.
            Log.e(TAG, "Firebase is not set up", e);
            PushEvents.notifyUnavailable("not_configured");
        }
        call.resolve();
    }
}
