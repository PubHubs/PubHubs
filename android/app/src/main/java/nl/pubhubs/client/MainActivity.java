package nl.pubhubs.client;

import android.os.Bundle;
import android.webkit.WebSettings;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Must precede super.onCreate: the bridge is built there, and it only
        // picks up plugins registered beforehand.
        registerPlugin(LinkHandlerPlugin.class);
        registerPlugin(ImageClipboardPlugin.class);
        super.onCreate(savedInstanceState);


        getBridge().getWebView().getSettings().setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        
    }
}
