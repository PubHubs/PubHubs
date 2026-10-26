package nl.pubhubs.client;

import android.content.Intent;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.activity.OnBackPressedCallback;

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
        registerPlugin(SystemBarColorPlugin.class);
        super.onCreate(savedInstanceState);

        getBridge().setWebViewClient(new HubOriginWebViewClient(getBridge()));

        // The layout root scrolls sideways between the menu and the hub. Its CSS
        // (no-scrollbar) hides the scroll bar the page draws, but Android draws the
        // WebView's own scroll bar natively, which only this switches off.
        getBridge().getWebView().setHorizontalScrollBarEnabled(false);

        // Capacitor only handles the system back gesture with its App plugin, which we don't use, so it
        // would always leave the app. Go back in the WebView's history first (from the register page to
        // the login page, say), and only leave the app when there is nothing left to go back to.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView webView = getBridge().getWebView();
                if (webView.canGoBack()) {
                    webView.goBack();
                    return;
                }
                setEnabled(false);
                getOnBackPressedDispatcher().onBackPressed();
                setEnabled(true);
            }
        });

        // Debug builds only: lets the native shell (served from https://pubhubs-app.invalid) fetch
        // plain-HTTP dev addresses (PHC/global-client/hub-client/Matrix API) without being blocked as
        // mixed content. Release builds keep strict mixed-content blocking. See docs/app/README.md.
        if (BuildConfig.DEBUG) {
            getBridge().getWebView().getSettings().setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }

        handlePushIntent(getIntent());
    }

    @Override
    public void onResume() {
        super.onResume();
        PushEvents.setAppInForeground(true);
    }

    @Override
    public void onPause() {
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
