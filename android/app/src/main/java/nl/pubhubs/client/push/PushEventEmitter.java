package nl.pubhubs.client.push;

import com.getcapacitor.JSObject;

/**
 * Implemented by each flavor's {@code NativePushPlugin} so {@link PushEvents} can hand it events
 * to forward to JS.
 *
 * <p>This indirection exists because {@code com.getcapacitor.Plugin.notifyListeners} is
 * {@code protected}: it's only callable from within a {@code Plugin} subclass itself (or another
 * class in its own package, {@code com.getcapacitor}), never through an externally-held
 * {@code Plugin} reference the way {@link PushEvents} needs to. Each {@code NativePushPlugin}
 * implements these methods as one-line calls to its own (inherited, therefore accessible)
 * {@code notifyListeners}.
 */
public interface PushEventEmitter {
    void emitPushTokenReceived(JSObject data);

    void emitPushUnavailable(JSObject data);

    void emitPushReceived(JSObject data);
}
