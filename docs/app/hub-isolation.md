# Hub isolation in the app

How the app keeps hubs apart from the shell and from each other, how that was checked, and what is
still open. For the app in general, see [The app](README.md); the iOS checks still to run are in the
[iOS test plan](ios-isolation-test.md).

## Why

On the web, the global client (the shell) runs on its own domain and embeds each hub's hub client in
an iframe from that hub's own domain. The same-origin policy keeps them apart: a hub frame can't touch
the shell's page or `localStorage` (where `PHauthToken` and `UserSecret` live), nor another hub's
frames, `localStorage` or IndexedDB. Shell and hubs only talk through `postMessage`, with origin
checks on both sides (`hub-client/src/stores/messagebox.ts`).

The app bundles the hub client instead (`npm run build:hub:native`, under `/hub/`). Served from the
shell's own origin, every hub would share that origin, and an XSS in any hub (say through content
from a compromised hub server) would get:

- the shell's page and `localStorage`, including the user's PubHubs login;
- every other hub's frame (whose URL carries that hub's access token) and IndexedDB;
- the Capacitor native bridge, which Android only offers to the shell's origin.

The `postMessage` origin checks don't help there: same-origin frames can call each other directly.

## Design

Each hub gets its own origin, `<label>.hubs.pubhubs-app.invalid`, with the shell's scheme
(`https://` on Android, `capacitor://` on iOS).

- **The label** is the hub ID (32 random bytes, in unpadded base64url) as lowercase unpadded base32:
  hostnames are case-insensitive, and 52 characters fit in a 63-character DNS label. The hub client
  (`hub-client/src/logic/utils/nativeHubOrigin.ts`) and the hub server
  (`pubhubs_hub/modules/pubhubs/_native_app.py`) compute it, with the same test vectors in their
  unit tests. Android doesn't compute it; it only checks that a host has the label's shape.
- **Same site, different origin.** `.invalid` isn't on the Public Suffix List, so every hub origin is
  same-site with the shell. That keeps hub storage from being treated as third-party (which would
  break IndexedDB), while the same-origin policy still keeps the origins apart.
- **Serving.**
  - Android: Capacitor's local server only serves its own host, so `HubOriginWebViewClient`
    (installed in `MainActivity`) serves `/hub/*` from the bundled assets for `https` hub hosts. It
    answers 404 for anything else, and refuses a hub URL as a top-level navigation. Hub hosts are
    deliberately not in `allowNavigation`: Capacitor would then fetch them from the network and offer
    them the native bridge.
  - iOS: the `capacitor://` scheme handler serves by path whatever the host, and allows frame
    navigation, so no native code was needed. It serves the whole bundle on a hub host, not only
    `/hub/`.
- **The CSP** of the shell (`global-client/index.html`) allows these frames: `frame-src` includes
  `https:` for Android and `capacitor:` for iOS.
- **The handshake.** The shell passes each hub's own origin to `messagebox.startCommunication`
  (`global-client/src/stores/hubs.ts`), so `postMessage` goes to that exact origin. A hub frame on a
  hub origin ignores `PARENT_URL`: it only accepts the shell's origins (`NATIVE_SHELL_ORIGINS`), and
  only from its direct parent, which must be the top window.
- **The storage key.** In the handshake, and only in the app, the shell also sends the hub a key for
  its own encrypted storage, derived from the user secret and the hub ID; see
  [Offline](offline.md#principles).

Extra checks, because the origin alone doesn't settle everything in the app:

- **Wrong hub.** The hub client refuses to start (`assertNativeHubOriginMatchesHubId` in `main.ts` and
  `miniclient.ts`) when its hostname doesn't match the `hubId` in its URL. Otherwise a compromised
  hub A could load its own frame on hub B's origin and read B's IndexedDB.
- **Wrong server.** In the app, `HUB_URL` comes from the frame's own URL, so the shell sends the hub
  server's address in its handshake reply. The hub client only completes the handshake, and so only
  logs in, if it matches its own `HUB_URL`.
- **CORS.** The hub server adds exactly its own two app origins (`https://` and `capacitor://`) to
  `allowed_origins`, once `Core` has resolved the hub's ID from PubHubs Central. It retries every 10
  seconds until it has. If PubHubs Central later gives the hub another ID, the hub keeps the old one
  until it restarts.

## Checks on Android

Checked on a GrapheneOS phone (Vanadium WebView 153) with two test hubs, by hand in the WebView's
DevTools console, in the shell and in every hub frame:

| Check                                                                                          | Result |
| ---------------------------------------------------------------------------------------------- | ------ |
| A hub's origin matches the label derived from its `hubId`                                      | ✅     |
| `parent.document`, `parent.localStorage`, `top.location.href` throw `SecurityError` in a hub   | ✅     |
| No `PHauthToken` or `UserSecret` in a hub's `localStorage`                                     | ✅     |
| `parent.frames`: the hub's own frames are readable, the other hub's frames blocked             | ✅     |
| `indexedDB.databases()` in a hub lists only that hub's own databases                           | ✅     |
| No `androidBridge` in hub frames; `Capacitor.isNativePlatform()` is `false` there              | ✅     |
| The shell can't read `contentWindow.document` of hub frames                                    | ✅     |
| A hub frame loaded on another hub's origin, with its own `hubId`: "hub-client refuses to start" | ✅     |
| A hub frame with a spoofed `HUB_URL`: handshake refused, no sync                               | ✅     |
| The shell's `location.href` set to a hub URL: blocked, the app stays                           | ✅     |
| The hub server sends `Access-Control-Allow-Origin` only for its own label                      | ✅     |

The two test hubs share a `server_name`, so their Matrix stores have the same IndexedDB name
(`pubhubs-db-@user:testhub.matrix.host`). On one shared origin they would have shared storage; now
each origin has its own.

For DevTools where `chrome://inspect` doesn't work, as on GrapheneOS, see
`scripts/devtools-origin-proxy.mjs`.

## Known gaps

- **The iOS native bridge.** The first iOS run (22 September 2026) found Capacitor's bridge handler in
  every hub frame. Capacitor registers its `bridge` message handler with
  `WKUserContentController.add(_:name:)`, which exposes `window.webkit.messageHandlers.bridge` to
  every frame, and `WebViewDelegationHandler.userContentController(_:didReceive:)` never looks at
  `message.frameInfo`. A hub frame can therefore probably call native plugins (Filesystem, Share,
  ...); the replies go to the main frame, so it can't read them. Capacitor's script also runs in
  every frame on iOS, so `Capacitor.isNativePlatform()` is `true` in hub frames. This was already so
  with hubs loaded from their own domains. The fix is native: drop bridge messages unless
  `frameInfo.isMainFrame` and `frameInfo.securityOrigin.host == "pubhubs-app.invalid"`, for example
  in a replacement for Capacitor's delegation handler (an `open` class, created in
  `CAPBridgeViewController`).
- **The Android bridge fallback.** Capacitor only offers the bridge to the shell's origin and the main
  frame when the WebView supports `addWebMessageListener`. On an older WebView without it, Capacitor
  falls back to `addJavascriptInterface`, which every frame can reach.
- **No process isolation.** Android's WebView runs all frames in one renderer process, so this is
  origin isolation, not site or process isolation. Spectre-class attacks are out of scope.

## Still open

- Run the [iOS test plan](ios-isolation-test.md): IndexedDB on the hub origins (the first run found no
  databases in the hub frames), a top-level navigation to a hub, and the wrong-server check.
- Fix the iOS native bridge gap.
- External hubs need a release with the CORS change before their users can use them in the app; see
  [What hubs need for the app](README.md#what-hubs-need-for-the-app).
