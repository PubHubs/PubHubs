package nl.pubhubs.client.push;

import android.util.Log;

import com.getcapacitor.JSObject;

/**
 * Hands events from a push transport's Service (FcmService in the gplay build, UnifiedPushService
 * in the fdroid build) to the NativePush plugin, when the app is running.
 *
 * <p>Android may start the process only to deliver a push, without an Activity or plugin, so
 * callers can't count on the JS layer hearing about it: that's what {@link LocalNotifier} is for.
 *
 * <p>A push carries only a random tag, which global-client/src/logic/nativePush.ts maps to the
 * hub it belongs to.
 */
public final class PushEvents {

    private static final String TAG = "NativePush";

    private static volatile PushEventEmitter activePlugin;
    private static volatile boolean appInForeground = false;

    private PushEvents() {}

    /** Called by NativePushPlugin.load() in each build. */
    public static void setActivePlugin(PushEventEmitter plugin) {
        activePlugin = plugin;
    }

    /** Called by MainActivity's onResume/onPause: in the foreground, JS handles a push itself. */
    public static void setAppInForeground(boolean inForeground) {
        appInForeground = inForeground;
    }

    public static boolean isAppInForeground() {
        return appInForeground;
    }

    /** A new device token, or for UnifiedPush an endpoint (plus its keys in {@code extra}). */
    public static void notifyTokenReceived(String transport, String token, JSObject extra) {
        Log.d(TAG, "token received (transport=" + transport + ")");
        PushEventEmitter plugin = activePlugin;
        if (plugin == null) return;

        JSObject data = extra != null ? extra : new JSObject();
        data.put("transport", transport);
        data.put("token", token);
        plugin.emitPushTokenReceived(data);
    }

    public static void notifyUnavailable(String reason) {
        Log.d(TAG, "unavailable (reason=" + reason + ")");
        PushEventEmitter plugin = activePlugin;
        if (plugin == null) return;

        JSObject data = new JSObject();
        data.put("reason", reason);
        plugin.emitPushUnavailable(data);
    }

    public static void notifyPushReceived(String tag) {
        Log.d(TAG, "push received (foreground=" + appInForeground + ")");
        PushEventEmitter plugin = activePlugin;
        if (plugin == null) return;

        JSObject data = new JSObject();
        data.put("tag", tag);
        plugin.emitPushReceived(data);
    }

    /**
     * What a Service does with a push: tell JS, and unless the app is in the foreground (where JS
     * just opens the hub), show the generic notification.
     */
    public static void handlePush(android.content.Context context, String tag) {
        if (tag == null || tag.isEmpty()) return;
        notifyPushReceived(tag);
        if (!isAppInForeground()) {
            LocalNotifier.show(context, tag);
        }
    }
}
