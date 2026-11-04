package nl.pubhubs.client.push;

import androidx.annotation.NonNull;

import com.getcapacitor.JSObject;

import org.json.JSONObject;
import org.unifiedpush.android.connector.FailedReason;
import org.unifiedpush.android.connector.PushService;
import org.unifiedpush.android.connector.data.PublicKeySet;
import org.unifiedpush.android.connector.data.PushEndpoint;
import org.unifiedpush.android.connector.data.PushMessage;

import java.nio.charset.StandardCharsets;

/**
 * fdroid build: UnifiedPush endpoint changes and pushes. Declared in the fdroid AndroidManifest.xml.
 *
 * <p>PHC sends Web Push (RFC 8291) messages, encrypted for the keys the connector generated and
 * hands over with the endpoint, so the UnifiedPush server only sees ciphertext. The connector
 * decrypts them; the content is {@code {"tag": ...}}.
 */
public class UnifiedPushService extends PushService {

    @Override
    public void onNewEndpoint(@NonNull PushEndpoint endpoint, @NonNull String instance) {
        PublicKeySet keys = endpoint.getPubKeySet();
        if (keys == null) {
            // Without keys PHC can't encrypt for us, and won't send in the clear.
            PushEvents.notifyUnavailable("no_keys");
            return;
        }
        JSObject extra = new JSObject();
        extra.put("p256dh", keys.getPubKey());
        extra.put("auth", keys.getAuth());
        PushEvents.notifyTokenReceived("webpush", endpoint.getUrl(), extra);
    }

    @Override
    public void onRegistrationFailed(@NonNull FailedReason reason, @NonNull String instance) {
        PushEvents.notifyUnavailable("registration_failed_" + reason.name().toLowerCase());
    }

    @Override
    public void onUnregistered(@NonNull String instance) {
        PushEvents.notifyUnavailable("unregistered");
    }

    @Override
    public void onMessage(@NonNull PushMessage message, @NonNull String instance) {
        if (!message.getDecrypted()) return; // not from PHC
        String tag;
        try {
            JSONObject json = new JSONObject(new String(message.getContent(), StandardCharsets.UTF_8));
            tag = json.optString("tag", null);
        } catch (Exception e) {
            return;
        }
        PushEvents.handlePush(getApplicationContext(), tag);
    }
}
