# Hub isolation in the native app

How the Capacitor app keeps hubs isolated from the app shell and from each other, how that was verified, and what came up along the way. For a short summary see the "Hub isolation" section in [README.md](README.md); the iOS test plan is [IOS_ISOLATION_TEST.md](IOS_ISOLATION_TEST.md).

## Background

On the web, global-client (the shell) runs on its own domain and embeds each hub's hub-client in an iframe loaded from that hub's own domain. The same-origin policy does the isolation: a hub iframe can't touch the shell's DOM or `localStorage` (where `PHauthToken` and `UserSecret` live), nor another hub's frames, `localStorage` or IndexedDB. Shell and hubs only talk through `postMessage`, with origin checks on both sides (`hub-client/src/stores/messagebox.ts`).

The app bundles hub-client instead (`npm run build:hub:native`, served under `/hub/`). Initially that bundle was served from the shell's own origin (`https://pubhubs-app.invalid` on Android, `capacitor://pubhubs-app.invalid` on iOS) for every hub. Shell and all hubs were then same-origin, so an XSS in any hub (for example through content from a compromised hub server) would have had:

- full access to `parent.document` and `parent.localStorage`, including the user's PubHubs login;
- access to every other hub's iframe (whose URL carries that hub's access token) and IndexedDB;
- the Capacitor native bridge, because Android only exposes it to the shell's origin, which hubs now shared.

The `postMessage` origin checks don't help there: same-origin frames can call each other directly.

## Design

Each hub gets its own origin: `<label>.hubs.pubhubs-app.invalid`, same scheme as the shell.

- **Label.** The hub ID is 32 random bytes in unpadded base64url. Hostnames are case-insensitive, so the label is the same bytes as lowercase unpadded base32 (52 characters, below the 63-character label limit). It's computed in three places that must agree: `hub-client/src/logic/utils/nativeHubOrigin.ts`, `android/.../HubOriginWebViewClient.java` and `pubhubs_hub/modules/pubhubs/_native_app.py`. The unit tests on both sides share the same test vectors.
- **Same site, different origin.** `.invalid` isn't on the Public Suffix List, so all hub origins are same-site with the shell. That keeps hub storage from being treated as third-party (which would otherwise break IndexedDB), while the same-origin policy still separates them.
- **Serving.**
  - Android: Capacitor's local server only serves its own host, so `HubOriginWebViewClient` (installed in `MainActivity`) serves `/hub/*` from the bundled assets for hub hosts. It returns 404 for anything else and refuses hub URLs as main-frame navigations. Hub hosts are deliberately not in `allowNavigation`: Capacitor would then proxy them to the network and add them to the origins that get the native bridge.
  - iOS: the `capacitor://` scheme handler serves by path regardless of host and allows subframe navigation, so no native code was needed.
- **Handshake.** global-client passes each hub's own origin to `messagebox.startCommunication`, so `postMessage` is exact-origin per hub. The parent-side exception that trusted the shared origin is gone.

Extra checks, because the origin alone doesn't pin down everything in the app:

- **Wrong hub.** hub-client refuses to start (`assertNativeHubOriginMatchesHubId` in `main.ts` / `miniclient.ts`) when its hostname doesn't match the `?hubId=` it was given. Without this, a compromised hub A could navigate its own frame to hub B's origin and read B's IndexedDB.
- **Wrong server.** In the app, `HUB_URL` comes from the iframe query string, so the parent sends the hub server URL in its handshake reply. The child only completes the handshake, and therefore only logs in, if it matches its own `HUB_URL`.
- **CORS.** The hub server adds exactly its own two app origins (`https://` and `capacitor://`) to `allowed_origins`, once `Core` has resolved the hub ID from PHC. It retries every 10 s until it has.

## Verification (Android)

Tested on a GrapheneOS phone (Vanadium WebView 153) with two test hubs. Each row was checked in the WebView's DevTools console, in the shell and in every hub frame, the way [IOS_ISOLATION_TEST.md](IOS_ISOLATION_TEST.md) describes the checks for iOS.

| Check | Result |
| --- | --- |
| Hub origin matches the label derived from `hubId` | ✅ |
| `parent.document`, `parent.localStorage`, `top.location.href` throw `SecurityError` in a hub frame | ✅ |
| No `PHauthToken` / `UserSecret` in a hub's `localStorage` | ✅ |
| `parent.frames`: own frames readable, the other hub's frames blocked | ✅ |
| `indexedDB.databases()` in a hub lists only its own `pubhubs-db-*` | ✅ |
| No `androidBridge` in hub frames; `Capacitor.isNativePlatform()` is `false` | ✅ |
| Shell can't read `contentWindow.document` of hub iframes | ✅ |
| Hub frame navigated to another hub's origin with its own `hubId`: `hub-client refuses to start` | ✅ |
| Hub frame with a spoofed `HUB_URL`: handshake refused, no sync | ✅ |
| Shell `location.href` set to a hub URL: blocked, app stays | ✅ |
| Hub server echoes `Access-Control-Allow-Origin` only for its own label | ✅ |

The two test hubs share a `server_name`, so their IndexedDB names (`pubhubs-db-@user:testhub.matrix.host`) could collide. With a shared origin they would have shared storage; now each origin has its own.

To attach DevTools to the app's WebView on GrapheneOS, where `chrome://inspect` doesn't work, see the header of [devtools-origin-proxy.mjs](devtools-origin-proxy.mjs).

## Known gaps

**iOS native bridge.** The first iOS run (22 September 2026) found the handler in every hub frame. Capacitor registers its `bridge` script message handler with `WKUserContentController.add(_:name:)`, which exposes `window.webkit.messageHandlers.bridge` to every frame. `WebViewDelegationHandler.userContentController(_:didReceive:)` never looks at `message.frameInfo`. A hub iframe can therefore probably trigger native plugin calls (Filesystem, Share, …); the replies are evaluated in the main frame, so it can't read them. This predates the bundling (it applied just as much to hubs loaded from their own domains), and separate origins don't change it. The fix is native: drop bridge messages unless `frameInfo.isMainFrame` and `frameInfo.securityOrigin.host == "pubhubs-app.invalid"`, for example by replacing Capacitor's delegation handler (an `open` class, created in `CAPBridgeViewController`). Capacitor's script also runs in every frame on iOS, so `Capacitor.isNativePlatform()` is `true` in hub frames.

**No process isolation.** Android WebView runs all frames in one renderer process, so this is origin isolation, not site or process isolation. Spectre-class attacks are out of scope.

## Open items

- Finish [IOS_ISOLATION_TEST.md](IOS_ISOLATION_TEST.md). Most important: IndexedDB on the hub origins under `capacitor://` (the first run found no databases in the hub frames). Also open: whether a shell navigation to a hub URL is blocked (no extra native block was added on iOS), the wrong-server check, and consent and video calls.
- Fix the iOS native bridge gap.
- Surface errors from `setUserConsentVersion` instead of silently retrying the route. When the consent `POST` fails (for example on CORS), the app currently looks like it hangs on the house rules.
- Deploy the hub server changes to production hubs before shipping an app build with per-hub origins, or CORS will block the app.
