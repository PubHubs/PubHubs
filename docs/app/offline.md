# Offline

How the app keeps working without a connection, or with a server that can't be reached. For the app in
general, see [The app](README.md).

Offline support is for the app only: on the web, Safari blocks storage in hub frames and the service
worker unregisters itself, so the web client stays online-only. The goal so far is **switching between
hubs you know**, with their room lists, offline. Offline messages and media come later, with the switch
to the Rust Matrix SDK.

## Why

Before this work, going offline broke the app in ways that also hurt on a flaky connection:

- **Starting offline logged the user out for good.** The router guard fetched the global settings from
  PubHubs Central on every navigation, and any failure deleted `PHauthToken` and `UserSecret`.
- **A failed settings load reset the settings.** Pinned hubs and hub tokens fell back to defaults, and
  saving those could overwrite the copy on PubHubs Central.
- **Nothing about hubs was kept on the device.** The hub list, pinned hubs and hub tokens came from
  PubHubs Central on every start.
- **A failed consent check locked the user on the house rules.**
- **matrix-js-sdk's push-rule retry loop has no pause**, so offline it kept the JavaScript thread busy.
- **No code told "offline" apart from "the server said no".**

## Principles

1. **Classify errors once, in the API layer.**
   - A `NetworkError` (`hub-client/src/logic/core/networkError.ts`) is a request that never got an
     answer: `fetch` threw, or the request timed out. `isNetworkError()` also recognises
     matrix-js-sdk's `ConnectionError` and raw `fetch` failures.
   - Everything else keeps its type: `ApiError` for HTTP errors, a plain `Error` for an `Err` from
     PubHubs Central.
   - `trackedFetch` (`reachability.ts`) is the `fetch` behind the API layer and matrix-js-sdk. It
     reports reachability (below), and leaves requests from a frame that is being unloaded pending,
     which stops matrix-js-sdk's push-rule loop.
   - Calls to PubHubs Central (`handleErrors` in `global-client/src/logic/utils/mssUtils.ts`) retry a
     network error a few times, with short pauses, before passing it on.

2. **No destructive action on a network error.**
   - Destructive means: logging out, deleting tokens, replacing settings with defaults, setting
     `needsConsent`, or navigating to an error page.
   - A `NetworkError` leaves the current state alone, and a retry follows.
   - **One exception: the house rules.** A failed consent check with no earlier answer on the device
     asks for consent. A request the hub's CORS policy blocks looks just like an unreachable hub, while
     the rest of the hub may work, so letting the user in would skip the house rules.
   - **The login check goes further** (`loadLoginAndSettings` in `global-client/src/stores/global.ts`).
     It keeps the stored login on any failure, also when PubHubs Central refuses rather than being
     unreachable: an auth token that is really no longer valid is caught by the refresh endpoint,
     which logs out properly. On a network error the user carries on with the settings on the device.
     On a refusal the check fails, so the user sees the login page, but nothing is deleted. The check
     runs while the user isn't logged in yet (the router guard) and when PubHubs Central comes back.

3. **Reachability per server, not one global flag.**
   - `hub-client/src/logic/core/reachability.ts` tracks every origin the app talks to (PubHubs Central,
     each hub server) as `online`, `offline` or `unknown`, from the outcome of real requests, with the
     browser's `online`/`offline` events as a hint. (`navigator.onLine` is `true` on a wifi without
     internet, but `offline` does mean "no network".)
   - While an origin is offline, a registered probe checks it with exponential backoff (1 second up to
     a minute) and jitter.
   - The shell and every hub frame each have their own.

4. **Fixed reconnect steps.** `onReconnect(origin, handler)` runs a handler every time an origin comes
   back, never twice at once, so each step can safely be repeated.
   - **Shell:** check the login and reload the global settings, then refresh the hub list.
   - **Hub:** check the consent again, and load the own profile. The sync only starts once the hub
     server has answered for the first time (`whenReachable`).

5. **Local first.** A screen reads from a store that is filled from the device first and refreshed
   from the network in the background. A failed refresh keeps the stored data.

6. **Storage by owner.**

   | Data                                                                | Where                                          | Encrypted                       |
   | ------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------- |
   | Hub list (the public directory)                                     | shell, `localStorage`                          | no                              |
   | Global settings: pinned hubs, hub tokens, theme, language           | shell, LocalStore                              | yes, key from the user secret   |
   | Hub data: consent state, hub settings, room list, own profile       | the hub's own IndexedDB (`HubStorage`)         | yes, per-hub key from the shell |
   | Public images: hub icons and banners                                | each context's own IndexedDB (`imageCache.ts`) | no                              |
   | The same on the web                                                 | memory, or LocalStore for small values         | yes                             |

   - Each hub has its own origin in the app (see [Hub isolation](hub-isolation.md)), so it can keep
     its data in its own IndexedDB. That scales, needs no `postMessage` round trip, and stays out of
     the shell's 5 MB `localStorage`.
   - In a browser, hub frames on other domains can't rely on storage, so hub data stays in memory or
     in the shell's LocalStore.
   - The hub list survives logout; it's public.

7. **Encryption at rest with a per-hub key.**
   - **The key:** the shell derives `SHA-256("ph:hubstorage:" + hubId || userSecret)` and sends it to
     the hub frame in the handshake, only in the app, and only to the hub's exact origin.
   - **What a hub can do with it:** read and write its own storage. It can't derive another hub's key
     or the user secret.
   - **Crypto-shredding:** logout deletes the user secret, so the key can no longer be derived and
     every hub's data becomes unreadable. The shell doesn't need to reach the hubs' storage for this
     (which it can't: they're other origins).
   - **Cleanup:** a hub that opens its storage with a different key (another user, or a new secret)
     deletes the old data.
   - **Without a key or storage:** if the key is missing (the web), or WebCrypto or IndexedDB is
     unavailable or too slow to open, `HubStorage` stores nothing and callers keep their data in
     memory. Hub data is never stored in plaintext.

8. **Conditional writes for the global settings.** The shell remembers the version (hash) of the
   settings it loaded, and writes with that hash. If PubHubs Central answers that its copy is
   different (or gone), the shell fetches it, merges it with the local changes against the version it
   loaded (a three-way merge, `globalSettingsMerge.ts`), and tries again, up to three times.
   - Scalar fields: a local change wins, otherwise the server's value.
   - Pinned hubs: merged per hub, keeping local additions, removals and new tokens.

9. **Features that need a network say so**, with "needs an internet connection"
   (`errors.needs_connection`) instead of a general error.
   - Done: entering a hub for the first time and the login page (the error page with that message),
     and saving the house rules (inline).
   - Still to do: Yivi in secured rooms and signing, PubHubs card issuance, video calls and room
     discovery.

10. **Sessions.** Hub access tokens don't expire (`register_device` issues no refresh token), so they
    work offline. The PubHubs Central auth token does expire; offline that means "refresh later", not
    "logged out". Only PubHubs Central's explicit `ReobtainAuthToken` answer, or a missing auth token,
    logs the user out.

## Status

| Step                     | Content                                                                                                                                                                        | Status                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------- |
| Foundations              | error classification; reachability and reconnect; `HubStorage` with a per-hub key; conditional settings writes; the simulation switch                                          | done                         |
| Shell                    | encrypted copy of the global settings on the device; hub list cache; no logout or error page on network errors; "needs a connection" for entering a new hub                     | done                         |
| Hub frame                | consent and hub settings from `HubStorage`; the room list and own profile as last known; image cache; sync starts when the hub server answers; offline texts instead of loading placeholders | done                         |
| Offline banner           | `hub-client/src/components/ui/OfflineBanner.vue` exists                                                                                                                        | not shown anywhere yet       |
| Later, with the Rust SDK | timelines, an outbox for sending, media                                                                                                                                        |                              |

Where things live:

- `hub-client/src/logic/core/`: `networkError.ts`, `reachability.ts`, `hubStorage.ts`, `imageCache.ts`
- `global-client/src/stores/global.ts` (login check, settings load and save, device copy),
  `logic/utils/globalSettingsMerge.ts`, `logic/utils/hubsCache.ts`
- `global-client/src/pages/App.vue` (`watchPHCReachability`), `hub-client/src/stores/pubhubs.ts`
  (`watchHubServer`, restoring the room list and own profile)
- `hub-client/src/stores/user.ts` (consent, own profile), `stores/rooms.ts` (room list),
  `stores/hub-settings.ts` (hub settings)

## Testing

- **Unit tests:** `msw` with `HttpResponse.error()`, per store and for the error classification.
- **Simulation:** in a debug build, `window.pubhubsSimulateOffline(['https://phc.example'])` or
  `pubhubsSimulateOffline(true)` in a context's console makes the listed origins (or everything) fail
  as if unreachable, for the API layer and matrix-js-sdk (not for images). `pubhubsSimulateOffline(false)`
  switches it off. In a hub frame it only exists once the hub has logged in.

On a device, with a debug build and a user who has opened at least two hubs while online:

1. **Flight mode, cold start.** Force-quit the app, switch on flight mode, and start it.
   - The user is still logged in, and the sidebar shows the pinned hubs.
   - Opening a hub shows its last known room list; opening a room says it needs a connection.
   - Switching to the other hub works the same way.
   - The hub's home page shows its description; the house rules aren't shown again.
2. **Needs a connection.** Still offline, open a hub the user never entered: the error page says it
   needs an internet connection.
3. **Change something offline.** Change the theme and pin or unpin a hub, then switch flight mode off.
   Within about a minute (sooner right after the network returns), the change reaches PubHubs Central:
   check by logging in on a second device, or by reloading the app. The room list fills in.
4. **Another device changed things meanwhile.** Repeat 3, pinning a different hub on a second device
   while the first is offline. After reconnecting, both pins are kept.
5. **PubHubs Central down.** With the network on, run `window.pubhubsSimulateOffline(['<PHC url>'])`
   in the shell's console: hubs still open and sync. `window.pubhubsSimulateOffline(false)` brings it
   back, and the reconnect steps run (visible in the console).
6. **One hub down.** Run `window.pubhubsSimulateOffline(true)` in a hub frame's console (pick the frame
   as in the [iOS test plan](ios-isolation-test.md#setup)): only that hub is affected.
7. **Logout.** Log out and log in as another user. The first user's hub data must not show up: it's
   unreadable with the new key, and is wiped when the hub opens.

## Known limits

- matrix-js-sdk's own IndexedDB store (`pubhubs-db-<userId>`) is not encrypted. With sliding sync it
  holds almost nothing, and it goes away with the Rust SDK.
- Offline, rooms can't be opened, and room lists only show hubs that were opened online before.
- Whether iOS gives the `capacitor://` hub origins a secure context (needed for WebCrypto) still has to
  be checked on a device. Without one, `HubStorage` keeps hub data in memory.
