package nl.pubhubs.client.push;

import com.getcapacitor.JSObject;

/**
 * Lets a push transport's background {@code Service} (FcmService in the gplay flavor,
 * UnifiedPushService in the fdroid flavor) hand events to the {@code NativePush} plugin instance
 * when the app happens to be running, without the two flavors' otherwise-separate
 * {@code NativePushPlugin} classes needing to duplicate this bookkeeping. See
 * {@link PushEventEmitter}'s doc for why this goes through an interface rather than a direct
 * {@code com.getcapacitor.Plugin} reference.
 *
 * <p>The plugin instance may not exist at all when a Service method runs: Android can start this
 * process purely to deliver a push, with no WebView/Activity (and so no Capacitor bridge/plugin)
 * around it. Callers must not assume {@link #notifyPushReceived} reaches the JS layer - that is
 * exactly why {@link LocalNotifier} exists as a separate, always-works fallback.
 */
public final class PushEvents {

    private static volatile PushEventEmitter activePlugin;
    private static volatile boolean appInForeground = false;

    private PushEvents() {}

    /** Called by NativePushPlugin.load() in each flavor. */
    public static void setActivePlugin(PushEventEmitter plugin) {
        activePlugin = plugin;
    }

    /**
     * Called by MainActivity's onResume/onPause. Lets a push transport's Service (FcmService /
     * UnifiedPushService) decide whether {@link LocalNotifier} should also show a system
     * notification: if the app is already in the foreground, {@link #notifyPushReceived} alone
     * is enough - JS can react immediately - and a system notification on top would just be a
     * redundant, distracting duplicate of what the app itself is about to show/do.
     */
    public static void setAppInForeground(boolean inForeground) {
        appInForeground = inForeground;
    }

    public static boolean isAppInForeground() {
        return appInForeground;
    }

    public static void notifyTokenReceived(String transport, String token) {
        PushEventEmitter plugin = activePlugin;
        if (plugin == null) return;

        JSObject data = new JSObject();
        data.put("transport", transport);
        data.put("token", token);
        plugin.emitPushTokenReceived(data);
    }

    public static void notifyUnavailable(String reason) {
        PushEventEmitter plugin = activePlugin;
        if (plugin == null) return;

        JSObject data = new JSObject();
        data.put("reason", reason);
        plugin.emitPushUnavailable(data);
    }

    /**
     * @param hubId Opaque hub identifier from the push payload - never room/event/message
     *     content, see the push notifications plan.
     */
    public static void notifyPushReceived(String hubId) {
        PushEventEmitter plugin = activePlugin;
        if (plugin == null) return;

        JSObject data = new JSObject();
        data.put("hub_id", hubId);
        plugin.emitPushReceived(data);
    }
}
