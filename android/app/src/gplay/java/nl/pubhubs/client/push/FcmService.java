package nl.pubhubs.client.push;

import androidx.annotation.NonNull;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

/**
 * gplay flavor: receives Firebase Cloud Messaging pushes and token refreshes.
 *
 * <p>Declared in AndroidManifest.xml (gplay flavor overlay) with the
 * {@code com.google.firebase.MESSAGING_EVENT} intent-filter action FCM requires.
 */
public class FcmService extends FirebaseMessagingService {

    @Override
    public void onNewToken(@NonNull String token) {
        // Can fire at any time, not just after NativePushPlugin.register() - e.g. Firebase
        // rotating the token server-side. global.ts's registration loop re-runs for every pinned
        // hub whenever a new token arrives, same as on first registration.
        PushEvents.notifyTokenReceived("fcm", token);
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        // Every push is a plain data message (no `notification` block - see the push
        // notifications plan), carrying only an opaque hub_id, so this always goes through
        // onMessageReceived rather than the OS auto-rendering something from a `notification`
        // payload.
        String hubId = remoteMessage.getData().get("hub_id");
        if (hubId == null) return;

        // Tell the JS layer directly if the app happens to be running (PushEvents). Only fall
        // back to a system notification (LocalNotifier) when the app isn't in the foreground:
        // Android may have started this process purely to deliver the push with no
        // WebView/plugin instance around at all, or the app may simply be backgrounded - but if
        // it's in the foreground, the live JS event alone is enough and a system notification on
        // top would just be a redundant, distracting duplicate.
        PushEvents.notifyPushReceived(hubId);
        if (!PushEvents.isAppInForeground()) {
            LocalNotifier.showHubActivity(getApplicationContext(), hubId);
        }
    }
}
