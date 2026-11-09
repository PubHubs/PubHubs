# Push notification strategies

PubHubs keeps hubs apart. Hubs and PubHubs Central (PHC) alone, may not learn which other hubs a
user is on. Push notifications make that hard. The whole network has one app identity (one APNs and
one FCM key), and the OS gives the app one device token, which is the same for every hub.

This compares four ways of dealing with that.

- **A. Sygnal in each hub**. Each hub runs a Sygnal push gateway next to Synapse. The app registers the device token with every hub. The hub removes the content and sends the push with its `hub_id` straight to Apple or Google.
- **B. PHC sends, relayed by the transcryptor**. On each hub the app registers a random `pushkey` and a blob: the token and a random per-hub tag, encrypted for PHC. The hub passes on only the blob, through the transcryptor (which hides the hub from PHC), to PHC. PHC decrypts the blob and sends a push that carries only the tag.
- **C. Empty wake-up push, details fetched on the device** (on top of B, the Signal model). PHC
  sends an empty push with no tag, and several pushes in a short window collapse into one. The app,
  in an iOS Notification Service Extension or an Android worker, asks each hub what's new and
  builds the notification itself.
- **F. No push provider.** Background polling of the hubs (iOS background refresh, Android
  WorkManager), plus UnifiedPush with a separate endpoint per hub in the F-Droid build.



| | A. Sygnal in each hub                                        | **B. PHC sends, transcryptor relays** | **C. Empty wake-up, fetch on device** | **F. No push provider** |
|---|---|---|---|---|
| **Privacy: can hubs link users?** | **Yes.** Every hub gets the same raw device token as `pushkey`. | No. Random `pushkey`, a different blob for each hub. | No, as B. | No, with a separate UnifiedPush endpoint per hub. Polling has nothing to link. |
| **Privacy: what Apple and Google learn** | Which hubs a device uses (a fixed `hub_id` in every push), and when. | When a device gets a push. Only a random tag per hub. | Only that a device gets a push. No tag at all. | Nothing. |
| **Privacy: what PHC learns** | Nothing. | Push tokens, and how many hubs each device uses. Linking the hubs needs PHC and the transcryptor together. | Push tokens only, not how many hubs. | Nothing. |
| **Privacy: timing** | A hub's push reaches Apple or Google immediately. | The transcryptor relays immediately, so PHC sees each push the moment the hub sends it. | As B. Also, all of a device's hubs get asked at the same moment. | When the device polls each hub, as in normal use of the app. |
| **Code in each hub** | ~220 lines: a proxy that removes content, Sygnal startup and Dockerfile, Sygnal config. **Plus Sygnal itself**, an extra dependency in its own venv. | ~100 lines: a proxy that passes on only the blob. | ~100, as B. | **None** with ntfy as the push gateway, but then the distributor sees room and event IDs. Otherwise ~100 for a proxy that removes them. |
| **Running a hub** | Run Sygnal, and hold the Apple/Google key (`.p8`). | Nothing to set up. | Nothing to set up. | Nothing to set up. |
| **Code in PHC and the transcryptor** | ~515 lines: an endpoint that gives hubs short-lived Apple/Google tokens. **No hub uses it yet**, and Sygnal can't use it without a patch. | ~1,125 lines: PHC's own sender (~890) that decrypts blobs and sends to APNs, FCM and Web Push (VAPID, RFC 8291), plus config, API and the transcryptor relay (~35). | ~1,100, about as B: no tag, but collapsing of pushes. | **None.** |
| **Code in the app** | ~255 lines TypeScript (`nativePush.ts`) and ~900 native: the iOS plugin, Android FCM, UnifiedPush and notifications. | ~360 lines TypeScript (adds the blob encryption, `pushBlob.ts`) and ~750 native. | B plus **~500–800 Swift** for an iOS Notification Service Extension (a new target, hub sessions in a shared keychain, fetching from each hub), and ~300 for Android. **The largest app change.** | ~300–500: iOS background refresh, Android WorkManager polling, a UnifiedPush endpoint per hub. The FCM and APNs code goes. |
| **Experience** | An immediate "You have new messages". Tapping it opens the right hub. | As A. | A few seconds later, but it says more: "New messages in Hub X", and the badge shows the right count. | iOS: **15 minutes to hours late, or not at all** for apps the user rarely opens. Android Play build: at least 15 minutes. F-Droid build: immediate. |
| **Battery and data** | Very little. iOS shows the notification without waking the app; Android wakes it briefly. | As A. | **More.** Every push wakes the app, which asks every hub it's logged in to (iOS gives it about 30 s). | **Low to moderate.** Regular requests to every hub, also when nothing happened. iOS limits how often, which is why notifications are so late. |
| **Depends on a central server** | No. | Every push goes through PHC and the transcryptor. If either is down, there are no pushes. | As B. | No. |
| **Abuse** | Every hub holds the network-wide key, so any hub can push to any PubHubs user. | The transcryptor's `.ph/push` is unauthenticated: anyone with a blob can push to that device, and the endpoint can be flooded. It needs a hub ticket and a rate limit. | As B, with less harm (an empty push). | Nothing new to abuse. |
| **Platforms** | iOS, Android (Play and F-Droid). | iOS, Android (Play and F-Droid). | iOS, Android (Play and F-Droid). | Only the F-Droid build gets notifications on time. On iOS there are effectively none. |
| **Our own crypto** | None. | Our own blob format, Web Push encryption and VAPID. Classical, not post-quantum like the keys between the servers. | As B. | None. |

## Conclusions

- **A** needs the least central code, but it lets hubs link users, and in practice every hub
  holds the network-wide key.
- **B** gives much better privacy with the same experience and battery use. It puts the code in PHC,
  and it is the only option where pushes depend on central servers.
- **C** says more in its notifications and hides from PHC how many hubs a device uses. It costs
  battery and the largest change to the app.
- **F** needs the least code and gives the best privacy, but on iOS notifications come too late to
  rely on. It fits as a fallback or an opt-in privacy mode.
