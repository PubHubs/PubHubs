package nl.pubhubs.client;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Must precede super.onCreate: the bridge is built there, and it only
        // picks up plugins registered beforehand.
        registerPlugin(LinkHandlerPlugin.class);
        registerPlugin(ImageClipboardPlugin.class);
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
    }
}
