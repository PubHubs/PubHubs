package nl.pubhubs.client.push;

import android.Manifest;
import android.content.Context;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.unifiedpush.android.connector.UnifiedPush;

import java.util.List;

/**
 * fdroid build: push notifications through UnifiedPush, with no Google code at all. Needs a
 * UnifiedPush distributor app (e.g. ntfy) on the device; without one this reports
 * "no_distributor".
 *
 * <p>Same plugin name and events as the gplay build's FCM plugin and iOS's NativePushPlugin.swift,
 * see global-client/src/logic/nativePush.ts. The endpoint and its Web Push keys arrive through
 * UnifiedPushService.onNewEndpoint.
 */
@CapacitorPlugin(
    name = "NativePush",
    permissions = {
        @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "receive")
    }
)
public class NativePushPlugin extends Plugin implements PushEventEmitter {

    private static final String TAG = "NativePushPlugin";

    /** One registration for all hubs: hubs never see the endpoint (see nativePush.ts). */
    private static final String INSTANCE = "default";

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
    public void emitPushReceived(JSObject data) {
        // Retained: a tap can start the app before JS listens.
        notifyListeners("pushReceived", data, true);
    }

    /**
     * Asks for permission, then registers with the distributor; the endpoint arrives through
     * "pushTokenReceived". Takes {@code vapid}: PHC's VAPID public key, as PHC sends the pushes.
     * Always resolves.
     */
    @PluginMethod
    public void register(PluginCall call) {
        if (getPermissionState("receive") != PermissionState.GRANTED) {
            requestPermissionForAlias("receive", call, "registerPermissionCallback");
            return;
        }
        registerWithDistributor(call);
    }

    @PermissionCallback
    private void registerPermissionCallback(PluginCall call) {
        if (getPermissionState("receive") == PermissionState.GRANTED) {
            registerWithDistributor(call);
        } else {
            PushEvents.notifyUnavailable("permission_denied");
            call.resolve();
        }
    }

    private void registerWithDistributor(PluginCall call) {
        Context context = getContext();
        String vapid = call.getString("vapid");
        if (vapid == null || vapid.isEmpty()) {
            PushEvents.notifyUnavailable("no_vapid_key");
            call.resolve();
            return;
        }

        if (UnifiedPush.getAckDistributor(context) == null) {
            List<String> distributors = UnifiedPush.getDistributors(context);
            if (distributors.isEmpty()) {
                PushEvents.notifyUnavailable("no_distributor");
                call.resolve();
                return;
            }
            // TODO: let the user choose when there are several.
            UnifiedPush.saveDistributor(context, distributors.get(0));
        }

        try {
            UnifiedPush.register(context, INSTANCE, null, vapid);
        } catch (Exception e) {
            // e.g. VapidNotValidException
            Log.e(TAG, "UnifiedPush.register failed", e);
            PushEvents.notifyUnavailable("registration_failed");
        }
        call.resolve();
    }
}
