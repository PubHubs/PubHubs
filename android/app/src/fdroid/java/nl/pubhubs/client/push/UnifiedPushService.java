package nl.pubhubs.client.push;

import androidx.annotation.NonNull;

import org.unifiedpush.android.connector.FailedReason;
import org.unifiedpush.android.connector.PushService;
import org.unifiedpush.android.connector.data.PushEndpoint;
import org.unifiedpush.android.connector.data.PushMessage;

import java.nio.charset.StandardCharsets;

/**
 * fdroid flavor: receives UnifiedPush endpoint updates and messages.
 *
 * <p>Declared in AndroidManifest.xml (fdroid flavor overlay) with {@link PushService#ACTION_PUSH_EVENT}
 * as the intent-filter action.
 *
 * <p>Verified against org.unifiedpush.android:connector 3.3.5's actual decompiled class files -
 * see NativePushPlugin.java's class doc.
 */
public class UnifiedPushService extends PushService {

    @Override
    public void onNewEndpoint(@NonNull PushEndpoint endpoint, @NonNull String instance) {
        // The endpoint URL is registered directly as the Matrix pusher's data.url - see
        // NativePushPlugin's class doc and the push notifications plan.
        PushEvents.notifyTokenReceived("unifiedpush", endpoint.getUrl());
    }

    @Override
    public void onRegistrationFailed(@NonNull FailedReason reason, @NonNull String instance) {
        // VAPID_REQUIRED surfaced distinctly rather than folded into a generic failure: it means
        // the chosen distributor requires a real VAPID key (see NativePushPlugin.register's
        // comment on why we currently pass an empty one) - an ops/config problem, not a
        // transient one, so it's worth being able to tell apart from NETWORK/INTERNAL_ERROR.
        String reasonString = reason == FailedReason.VAPID_REQUIRED ? "vapid_required" : "registration_failed";
        PushEvents.notifyUnavailable(reasonString);
    }

    @Override
    public void onUnregistered(@NonNull String instance) {
        PushEvents.notifyUnavailable("unregistered");
    }

    @Override
    public void onMessage(@NonNull PushMessage message, @NonNull String instance) {
        // Every push is expected to be a small JSON object carrying only an opaque hub_id (see
        // the push notifications plan) - never message content. UnifiedPush hands us raw bytes;
        // there is no structured "data payload" concept like FCM's, so we parse it ourselves.
        String hubId;
        try {
            org.json.JSONObject json = new org.json.JSONObject(
                new String(message.getContent(), StandardCharsets.UTF_8)
            );
            hubId = json.optString("hub_id", null);
        } catch (Exception e) {
            hubId = null;
        }
        if (hubId == null) return;

        // See FcmService's identical comment: only fall back to a system notification when the
        // app isn't already in the foreground to react to the live JS event.
        PushEvents.notifyPushReceived(hubId);
        if (!PushEvents.isAppInForeground()) {
            LocalNotifier.showHubActivity(getApplicationContext(), hubId);
        }
    }
}
