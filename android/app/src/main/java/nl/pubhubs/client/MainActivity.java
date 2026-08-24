package nl.pubhubs.client;

import android.content.Intent;
import android.os.Bundle;
import android.webkit.WebSettings;

import com.getcapacitor.BridgeActivity;

import nl.pubhubs.client.push.NativePushPlugin;
import nl.pubhubs.client.push.PushEvents;

public class MainActivity extends BridgeActivity {

    /**
     * Intent extra {@link nl.pubhubs.client.push.LocalNotifier} attaches to the notification it
     * shows for a push received while there was no live plugin instance to tell directly (see
     * PushEvents). Carries only the opaque hub id, never message content.
     */
    public static final String EXTRA_PUSH_HUB_ID = "nl.pubhubs.client.push.HUB_ID";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Must precede super.onCreate: the bridge is built there, and it only
        // picks up plugins registered beforehand.
        registerPlugin(LinkHandlerPlugin.class);
        registerPlugin(ImageClipboardPlugin.class);
        // NativePushPlugin resolves to whichever flavor's implementation (gplay/FCM or
        // fdroid/UnifiedPush) is on this build variant's classpath - see
        // src/{gplay,fdroid}/java/nl/pubhubs/client/push/NativePushPlugin.java.
        registerPlugin(NativePushPlugin.class);
        super.onCreate(savedInstanceState);

        // Debug builds only: lets the native shell (served from https://pubhubs-app.invalid) fetch
        // plain-HTTP dev addresses (PHC/global-client/hub-client/Matrix API) without being blocked as
        // mixed content. Release builds keep strict mixed-content blocking. See docs/app/README.md.
        if (BuildConfig.DEBUG) {
            getBridge().getWebView().getSettings().setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }

        handlePushIntent(getIntent());
    }

    @Override
    protected void onResume() {
        super.onResume();
        PushEvents.setAppInForeground(true);
    }

    @Override
    protected void onPause() {
        PushEvents.setAppInForeground(false);
        super.onPause();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        // launchMode="singleTask" (AndroidManifest.xml) means a tapped notification while the
        // app is already running arrives here rather than through a fresh onCreate.
        super.onNewIntent(intent);
        handlePushIntent(intent);
    }

    /**
     * If {@code intent} came from tapping a {@link nl.pubhubs.client.push.LocalNotifier}
     * notification, relays it to the JS layer as the same "pushReceived" event a push handled
     * while the app was already running would produce, so both paths converge on one code path
     * in global-client's nativePush.ts.
     */
    private void handlePushIntent(Intent intent) {
        if (intent == null) return;

        String hubId = intent.getStringExtra(EXTRA_PUSH_HUB_ID);
        if (hubId == null) return;

        // consume it, so rotating the screen or otherwise recreating the activity doesn't
        // re-deliver the same event
        intent.removeExtra(EXTRA_PUSH_HUB_ID);

        PushEvents.notifyPushReceived(hubId);
    }
}
