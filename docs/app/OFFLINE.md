# Offline support in the native app

Design for making the Capacitor app usable without a network. Offline support is a **native-only** goal: on the web, Safari blocks storage in hub iframes and the service worker unregisters itself, so the web client stays online-only.

The first milestone is **switching between hubs offline**. Offline rooms, messages and media come later, once hub-client has moved to the Rust Matrix SDK, and are out of scope here. The foundations below are meant to carry those later steps too.

## Starting point

Before this work, going offline broke the app in ways that also bite on flaky connections:

- **Starting offline logged the user out for good.** The router guard fetched the global settings from PHC on every navigation, and any failure deleted `PHauthToken` and `UserSecret`.
- **A failed settings load reset the settings.** Pinned hubs and hub tokens fell back to defaults, and saving those could overwrite the server copy.
- **Nothing about hubs was kept on the device.** The hub list, pinned hubs and hub tokens came from PHC on every start.
- **A failed consent check locked the user on the house rules.** The hub then redirected every page to onboarding.
- **matrix-js-sdk's push-rule retry loop has no pause.** Offline, it runs non-stop before the sync even starts.
- **No code told "offline" apart from "the server said no".**

## Principles

1. **Classify errors once, in the API layer.**
   - `NetworkError` (`hub-client/src/logic/core/networkError.ts`): the request never got an answer. `fetch` threw, or the request timed out.
   - Everything else keeps its current type: `ApiError` for HTTP errors, a plain `Error` for PHC `Err` results.
   - `isNetworkError()` also recognises matrix-js-sdk's `ConnectionError` and raw `fetch` failures.

2. **No destructive action on a network error.**
   - Destructive means: logging out, deleting tokens, replacing settings with defaults, setting `needsConsent`, or navigating to an error page.
   - A `NetworkError` leaves the current state alone and schedules a retry.
   - One exception: a failed consent check with no known consent state asks for consent. A request the hub's CORS policy blocks looks just like an unreachable hub, while the rest of the hub may still work, so letting the user in would skip the house rules.

3. **Reachability per server, not one global flag.**
   - `hub-client/src/logic/core/reachability.ts` tracks every origin the app talks to (PHC, each hub server) as `online`, `offline` or `unknown`.
   - **Inputs:**
     - the outcome of real requests;
     - `online`/`offline` window events, as a hint only. `navigator.onLine` is `true` on a wifi without internet, but `offline` does reliably mean "no network".
   - **Probes:** while an origin is offline, a registered probe checks it with exponential backoff and jitter.
   - **Contexts:** the shell and every hub frame each have their own instance.

4. **Fixed reconnect steps per context.** `onReconnect(origin, handler)` runs a handler every time an origin comes back. The handler is never run twice at once, so each step can safely be repeated.
   - **Shell:** reload the global settings, then refresh the hub list.
   - **Hub:** re-check consent. The sync itself only starts once the hub server has answered for the first time (`whenReachable`).

5. **Local first.** A screen reads from a store that is filled from local storage first and refreshed from the network in the background. A failed refresh keeps the stored data.

6. **Storage by owner.**

   | Data | Where | Encrypted |
   | --- | --- | --- |
   | Hub list (public directory) | shell, `localStorage` | no |
   | Global settings: pinned hubs, hub tokens, theme, language | shell, LocalStore | yes, key from the user secret |
   | Hub data: consent state, hub settings, later rooms | the hub's own IndexedDB (`HubStorage`) | yes, per-hub key from the shell |
   | The same on the web | memory, or LocalStore for small values | yes |

   - **Where hub data lives:** each hub has its own origin in the native app (see [HUB_ISOLATION.md](HUB_ISOLATION.md)), so it can keep its data in its own IndexedDB. That scales, needs no `postMessage` round trip, and stays out of the shell's 5 MB `localStorage`.
   - **Why the web differs:** in a browser, hub iframes on other domains can't rely on storage, so hub data stays in memory or in the shell's LocalStore.

7. **Encryption at rest with a per-hub key.**
   - **The key:** the shell derives `SHA-256("ph:hubstorage:" + hubId || userSecret)`. It sends that key to the hub frame in the messagebox handshake, only in the native app, and only to the hub's exact origin.
   - **What a hub can do with it:** read and write its own storage. It can't derive another hub's key or the user secret.
   - **Crypto-shredding:** logout deletes the user secret, so the key can no longer be derived and every hub's data becomes unreadable. The shell doesn't need to reach the hubs' storage for this (which it can't, since they're other origins).
   - **Cleanup:** a hub that opens its storage with a different key (another user, or a new secret) deletes the old data.
   - **Rust SDK:** its IndexedDB store takes a passphrase, so the same key can be passed to it later.
   - **Without a key or storage:** if the key is missing (web), or WebCrypto or IndexedDB is unavailable, `HubStorage` reports that it can't store anything. Callers then keep their data in memory; nothing is ever stored in plaintext.

8. **Conditional writes for the global settings.**
   - **Why:** `storeUserObject` used to fetch the current hash just before writing, so every write won.
   - **Now:** the shell remembers the hash it loaded and writes with that hash. If PHC answers `HashDidNotMatch`, the shell fetches the server copy, merges it with the local changes against the last loaded version (a three-way merge), and retries.
   - **Merge rules:**
     - Scalar fields: a local change wins, otherwise the server value.
     - Pinned hubs: merged per hub, with local additions, removals and new tokens kept.

9. **Features that need a network say so.** They get a "needs a connection" message (`errors.needs_connection`) instead of an error page.
   - Done: entering a hub for the first time, the login page, and accepting a hub's house rules.
   - Still to do: Yivi in secured rooms and signing, PubHubs card issuance, video calls and room discovery.

10. **Sessions.**
    - Hub access tokens don't expire (`register_device` issues no refresh token), so they work offline.
    - The PHC auth token does expire. Offline that means "refresh later", not "logged out". PHC's explicit `ReobtainAuthToken` answer is still the only thing that logs the user out.

11. **Testing.**
    - **Unit tests:** `msw` with `HttpResponse.error()` for each store and for the error classification.
    - **On a device:** flight mode, plus two cases a flight-mode test can't create: "PHC down, hubs up" and "one hub down".
    - **Simulation switch:** in debug builds, `window.pubhubsSimulateOffline(['https://phc.example'])` or `pubhubsSimulateOffline(true)` in any context's console makes the listed origins (or everything) fail as if unreachable, for requests through the API layer and for matrix-js-sdk. `pubhubsSimulateOffline(false)` switches it off again.

## Roadmap

| Step | Content | Result | Status |
| --- | --- | --- | --- |
| 0. Foundations | error classification; reachability and reconnect; `HubStorage` with a per-hub key; conditional settings writes; simulation switch | nothing visible, but everything below builds on it | done |
| 1. Shell | encrypted local copy of the global settings; hub list cache; settings loaded once instead of on every navigation; no logout or error page on network errors; offline message for first-time hub entry | switching between known hubs offline | done |
| 2. Hub frame | consent/onboarding state backed by `HubStorage`; cached hub settings; sync starts only when the hub server is reachable; offline banner instead of endless loading placeholders; public-rooms timestamp fix; onboarding and error routes not reported to the shell | opening a known hub offline shows a usable hub page | done |
| Later, with the Rust SDK | room list, timelines, outbox for sending, media cache | rooms and messages offline | |

Where things live:

- `hub-client/src/logic/core/networkError.ts`, `reachability.ts`, `hubStorage.ts`
- `global-client/src/stores/global.ts` (settings load, save, device copy), `logic/utils/globalSettingsMerge.ts`, `logic/utils/hubsCache.ts`
- `global-client/src/pages/App.vue` (`watchPHCReachability`), `hub-client/src/stores/pubhubs.ts` (`watchHubServer`)
- `hub-client/src/stores/user.ts` (consent), `stores/hub-settings.ts` (hub settings)

## Testing on a device

Use a debug build, and use a user who has opened at least two hubs while online.

1. **Flight mode, cold start.** Force-quit the app, switch on flight mode, and start it.
   - The user is still logged in, and the sidebar shows the pinned hubs.
   - Opening a hub shows it with the offline banner. The room list says rooms appear once there's a connection, instead of showing loading placeholders.
   - Switching to the other hub works the same way.
   - The hub's home page shows its description; the house rules aren't shown again.
2. **Needs a connection.** Still offline, open a hub the user never entered: a "needs an internet connection" message appears instead of an error page.
3. **Change something offline.** Change the theme and pin or unpin a hub. Switch flight mode off.
   - Within about a minute (sooner right after the network returns), the change reaches PHC. Check this by logging in on a second device, or by reloading the app.
   - The banner disappears and the room list fills in.
4. **Another device changed things meanwhile.** Repeat 3, pinning a different hub on a second device while the first is offline. After reconnecting, both pins are kept.
5. **One server down.** With the network on, run `window.pubhubsSimulateOffline(['<PHC url>'])` in the shell's console:
   - hubs still open and sync, since only PHC is "down";
   - `window.pubhubsSimulateOffline(false)` brings it back, and the reconnect steps run (visible in the console).
6. **One hub down.** Run `window.pubhubsSimulateOffline(true)` in a hub frame's console (see [HUB_ISOLATION.md](HUB_ISOLATION.md) for picking a frame): that hub shows the banner, while the other hubs are unaffected.
7. **Logout.** Log out and log in as another user. The first user's hub data must not show up. Their `pubhubs-hub-storage` entries are unreadable with the new key and get wiped when the hub opens.

## Known limits

- The current matrix-js-sdk IndexedDB store (`pubhubs-db-<userId>`) is not encrypted. With sliding sync it holds almost nothing, and it goes away with the switch to the Rust SDK.
- Room lists stay empty offline until the Rust SDK step, so the hub page shows an offline state instead.
- Whether iOS gives `capacitor://` hub origins a secure context (needed for WebCrypto) must be checked on a device. Without it, `HubStorage` falls back to memory.
