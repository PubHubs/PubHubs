package nl.pubhubs.client.push;

import com.getcapacitor.JSObject;

/**
 * Implemented by each build's NativePushPlugin, so {@link PushEvents} can hand it events:
 * {@code Plugin.notifyListeners} is protected, so only the plugin itself can call it.
 */
public interface PushEventEmitter {
    void emitPushTokenReceived(JSObject data);

    void emitPushUnavailable(JSObject data);

    /** The user tapped a push notification: JS opens its hub. */
    void emitPushTapped(JSObject data);
}
