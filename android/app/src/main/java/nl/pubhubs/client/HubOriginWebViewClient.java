package nl.pubhubs.client;

import android.content.res.AssetManager;
import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URLConnection;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Serves the bundled hub client on an origin of its own for every hub.
 *
 * <p>The app bundles one hub client for all hubs, under {@code /hub/}. If
 * every hub loaded it from the app's own origin, each hub's iframe could reach
 * into the app and into the other hubs. So instead each hub loads it from
 * {@code https://<label>.hubs.pubhubs-app.invalid/hub/}, where the label is
 * derived from the hub id (see hub-client's nativeHubOrigin.ts), and the
 * browser keeps them apart.
 *
 * <p>Capacitor only serves the app on its own host, so this client serves the
 * hub hosts itself, straight from the bundled files. These hosts are
 * deliberately not in {@code allowNavigation}: Capacitor would then fetch them
 * from the network, and would hand them its native bridge as well.
 */
class HubOriginWebViewClient extends BridgeWebViewClient {

    /** 52 characters: a 32-byte hub id in lowercase base32. */
    private static final Pattern HUB_HOST = Pattern.compile("^[a-z2-7]{52}\\.hubs\\.pubhubs-app\\.invalid$");

    private static final String HUB_PATH_PREFIX = "/hub/";

    /** Capacitor copies the web build here (webDir in capacitor.config.ts). */
    private static final String ASSET_DIR = "public";

    private final AssetManager assets;

    HubOriginWebViewClient(Bridge bridge) {
        super(bridge);
        this.assets = bridge.getContext().getAssets();
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        if (!isHubUrl(request.getUrl())) return super.shouldInterceptRequest(view, request);
        return serveHubAsset(request.getUrl());
    }

    @Override
    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        if (!isHubUrl(request.getUrl())) return super.shouldOverrideUrlLoading(view, request);
        // A hub client belongs in its iframe; never let it replace the app itself.
        return request.isForMainFrame();
    }

    private static boolean isHubUrl(Uri url) {
        String host = url.getHost();
        return "https".equals(url.getScheme()) && host != null && HUB_HOST.matcher(host).matches();
    }

    private WebResourceResponse serveHubAsset(Uri url) {
        String path = url.getPath();
        if (path == null || !path.startsWith(HUB_PATH_PREFIX) || path.contains("..")) return notFound();
        if (path.endsWith("/")) path += "index.html";

        InputStream stream;
        try {
            stream = assets.open(ASSET_DIR + path);
        } catch (IOException e) {
            return notFound();
        }
        return new WebResourceResponse(mimeType(path), null, 200, "OK", defaultHeaders(), stream);
    }

    private static String mimeType(String path) {
        // Same approach as Capacitor's WebViewLocalServer: guessContentTypeFromName does not know *.js,
        // and module scripts are refused without a JavaScript type.
        String mimeType = URLConnection.guessContentTypeFromName(path);
        if (mimeType != null) return mimeType;
        if (path.endsWith(".js") || path.endsWith(".mjs")) return "application/javascript";
        if (path.endsWith(".wasm")) return "application/wasm";
        if (path.endsWith(".svg")) return "image/svg+xml";
        if (path.endsWith(".woff2")) return "font/woff2";
        return "application/octet-stream";
    }

    private static WebResourceResponse notFound() {
        return new WebResourceResponse("text/plain", null, 404, "Not Found", defaultHeaders(), new ByteArrayInputStream(new byte[0]));
    }

    private static Map<String, String> defaultHeaders() {
        Map<String, String> headers = new HashMap<>();
        headers.put("Cache-Control", "no-cache");
        return headers;
    }
}
