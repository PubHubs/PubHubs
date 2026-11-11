package nl.pubhubs.client.push;

import androidx.annotation.NonNull;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

/** gplay build: Firebase Cloud Messaging token changes and pushes (data only, with a sealed tag). */
public class FcmService extends FirebaseMessagingService {

    @Override
    public void onNewToken(@NonNull String token) {
        // Firebase may rotate the token at any time; nativePush.ts registers the new one everywhere.
        PushEvents.notifyTokenReceived("fcm", token, null);
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        PushEvents.handlePush(getApplicationContext(), remoteMessage.getData().get("sealed_tag"));
    }
}
