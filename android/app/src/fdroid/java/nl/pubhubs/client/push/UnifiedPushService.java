package nl.pubhubs.client.push;

import androidx.annotation.NonNull;

import org.unifiedpush.android.connector.PushService;
import org.unifiedpush.android.connector.data.PushEndpoint;
import org.unifiedpush.android.connector.data.PushMessage;

import java.nio.charset.StandardCharsets;

/**
 * fdroid flavor: receives UnifiedPush endpoint updates and messages.
 *
 * <p>Declared in AndroidManifest.xml (fdroid flavor overlay) with the intent-filter action the
 * UnifiedPush connector library requires to bind this service.
 *
 * <p>NEEDS VERIFICATION - see NativePushPlugin.java's class doc: the base class name, its
 * override signatures, and PushEndpoint/PushMessage's shape are from best recollection of the
 * connector library's v2.x contract, not confirmed against its actual source or docs.
 */
public class UnifiedPushService extends PushService {

    @Override
    public void onNewEndpoint(@NonNull PushEndpoint endpoint, @NonNull String instance) {
        // The endpoint URL is registered directly as the Matrix pusher's data.url - see
        // NativePushPlugin's class doc and the push notifications plan.
        PushEvents.notifyTokenReceived("unifiedpush", endpoint.getUrl());
    }

    @Override
    public void onRegistrationFailed(@NonNull org.unifiedpush.android.connector.FailedReason reason, @NonNull String instance) {
        PushEvents.notifyUnavailable("registration_failed");
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
