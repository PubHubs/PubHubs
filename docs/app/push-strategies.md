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

## Decision

**We go for B**: PHC sends, relayed by the transcryptor. It keeps hubs from linking users, gives
the same experience and battery use as A, and needs no push setup in the hubs.

**Maybe later C.** C builds on B, so B is not wasted work. It hides from PHC how many hubs a
device uses and gives better notifications, but costs battery and the largest change to the app.

Still open: the [improvement for B](#improvement-a-different-looking-tag-on-every-push) (a
different-looking tag on every push), and the abuse protection for the transcryptor's `.ph/push`
(a hub ticket and a rate limit, see the comparison).

## How a push travels, per option

Every option has two parts. **Registration** happens once per hub, and again when the device's
token changes: it decides who stores what. **The push** happens for every new message. In all
options it starts the same way: the hub's Synapse sees a new event for the user and calls the
push gateway the app registered, with the Matrix Push Gateway API (`_matrix/push/v1/notify`).
Synapse's request holds the pusher (`pushkey`, `app_id`, its `data`), the `room_id`, `event_id`,
unread counts and a priority.

The OS gives the app one push address per device. On iOS that's an APNs device token, in the
Android Play build an FCM token, and in the F-Droid build a UnifiedPush endpoint from a distributor
app such as ntfy, with Web Push keys. Below, "token" means any of these.

### The identifiers in a push

- **`hub_id`**: the hub's id in PubHubs, which PHC gives the hub (32 bytes, base64url). It is
  fixed and the same for every user of that hub. The hub's Synapse doesn't put it in the push
  itself. Only option A's push gateway proxy adds it, so the app knows which hub to open.
  Anyone who sees it knows which hub the push is from.
- **`event_id`**: the Matrix id of the one message that caused the push. Synapse makes it, and
  it is different for every message. On its own it doesn't say which hub, room or sender it's
  from, but the hub can look it up. If it gets out, the hub and whoever saw it can match the push
  to the exact message.
- **`room_id`**: the Matrix room. Like `event_id`, it comes from Synapse.
- **`tag`** (B only): a random value the app makes for each hub. Only the app knows which hub it
  belongs to. It is random, but it is still an id: it is **fixed for one device on one hub**. The
  app makes it once, and keeps it when the device's token changes. Only logging out of the hub or
  clearing the app's data gives a new one. Unlike `hub_id`, two users of the same hub have
  unrelated tags. But whoever sees it on every push can tell which pushes come from the same hub.
  See [the improvement for B](#improvement-a-different-looking-tag-on-every-push).

Where each identifier ends up (**bold**: leaves the hub):

| | `hub_id` | `event_id` | `room_id` |
|---|---|---|---|
| A | Added by the hub's proxy. **Goes to Sygnal, Apple/Google, the device.** | **Goes on to Sygnal, Apple/Google, the device** (Sygnal needs it, see below). | Removed by the hub's proxy. |
| B | Not in the push. The transcryptor knows the hub from the request, but doesn't pass that on. The device gets a `tag` instead. | Removed by the hub's gateway. | Removed by the hub's gateway. |
| C | Not in the push. The device learns the hub by asking each hub itself. | Removed by the hub's gateway. The device fetches new messages from the hub directly. | Removed by the hub's gateway. |
| F (F-Droid) | Not in the push. The app knows the hub from the endpoint. | **Goes to the distributor (e.g. ntfy) and the device**, unless a hub proxy removes it. | **As `event_id`.** |
| F (polling) | No push. | No push. | No push. |

### A. Sygnal in each hub

```
app ──pushers/set {pushkey = token, app_id}──▶ every hub

hub's Synapse ──{pushkey, app_id, room_id, event_id, counts, prio}──▶ hub's push gateway proxy
                                    proxy: drops room_id and counts, keeps event_id, ADDS hub_id
              ──{token, event_id, hub_id, alert keys, prio}────────▶ hub's Sygnal  (holds the .p8 / FCM key)
              ──{event_id, hub_id, alert keys}─────────────────────▶ Apple / Google
              ──{event_id, hub_id}─────────────────────────────────▶ device ─▶ app opens hub_id
                                                                              (event_id isn't used)
```

`event_id` goes all the way to the device only because Sygnal needs it: without one, Sygnal's
`event_id_only` mode doesn't apply and it builds an alert from the message content. The app
doesn't use it. `hub_id` is what the app uses: it opens that hub on a tap.

Registration:

| # | Who | Does | Sends | To | Stores |
|---|---|---|---|---|---|
| 1 | OS | gives the app its token | token | app | |
| 2 | App | registers a pusher on every hub it's logged in to | `pushkey` = the token, `app_id` of the build, gateway = the hub's own `_matrix/push/v1/notify` | each hub | Hub: the raw token. **The same on every hub.** |

Push:

| # | Who | Does | Sends | To |
|---|---|---|---|---|
| 1 | Synapse (hub) | sees a new event for the user | pushkey, app_id, room_id, event_id, counts, prio | the hub's push gateway proxy |
| 2 | Push gateway proxy (hub) | drops `room_id` and counts. Keeps `event_id` for Sygnal. **Adds `hub_id`** (its own, from PHC). For iOS also adds the alert's string keys and sets high priority. | token, `event_id`, `hub_id`, alert keys, prio | Sygnal, in the same container |
| 3 | Sygnal (hub) | signs with the network-wide Apple/Google key | token, `event_id`, `hub_id`, alert keys | APNs or FCM |
| 4 | APNs / FCM | delivers. **Sees `hub_id` and `event_id`.** | `event_id`, `hub_id`, alert keys | the device |
| 5 | Device / app | iOS shows the alert itself, from the app's strings. Android wakes the app, which shows it. A tap opens the hub with that `hub_id`. `event_id` is ignored. | | |

**Sends the push:** the hub. **Holds the Apple/Google keys:** every hub. PHC has an endpoint that
gives hubs short-lived Apple/Google tokens instead, so hubs wouldn't need the `.p8`, but Sygnal
can't use it without a patch.

### B. PHC sends, relayed by the transcryptor

```
app ──pushers/set {random pushkey, blob = Enc_PHC(token, tag)}──▶ every hub  (a fresh blob each)

hub's Synapse ──{pushkey, blob, room_id, event_id, counts, prio}──▶ hub's push gateway
                                    gateway: drops room_id, event_id, counts, pushkey; no hub_id added
              ──{blob, prio}───────────────────────────────────────▶ transcryptor  (knows the hub, can't read the blob)
              ──{blob, prio}, sealed for PHC────────────────────────▶ PHC           (reads the blob, doesn't know the hub)
              ──{token, tag, alert keys}────────────────────────────▶ Apple / Google / UnifiedPush server
              ──{tag}───────────────────────────────────────────────▶ device ─▶ app maps tag to hub, opens it
```

Registration:

| # | Who | Does | Sends | To | Stores |
|---|---|---|---|---|---|
| 1 | OS | gives the app its token | token | app | |
| 2 | App | gets PHC's public blob key | | PHC (`.ph/push/info`) | |
| 3 | App | for every hub, makes a random `pushkey`, a random `tag`, and encrypts token and tag for PHC (fresh each time, so every hub gets a different blob) | | | App, on the device only: `hub_id` → {pushkey, tag} |
| 4 | App | registers a pusher on every hub | `pushkey`, `data.blob`, `app_id`, gateway = the hub's own `_matrix/push/v1/notify` | each hub | Hub: pushkey and blob. No token. |

Push:

| # | Who | Does | Sends | To |
|---|---|---|---|---|
| 1 | Synapse (hub) | sees a new event for the user | pushkey, blob, room_id, event_id, counts, prio | the hub's push gateway |
| 2 | Push gateway (hub) | drops everything except the blob and the priority: **`event_id` and `room_id` stop here**. Adds no `hub_id`. | blob, prio | transcryptor (`.ph/push`) |
| 3 | Transcryptor | knows which hub calls it, but seals the request for PHC without saying so: **no `hub_id` to PHC** | blob, prio | PHC (`.ph/push/send`) |
| 4 | PHC | decrypts the blob, signs with the Apple/Google key (Web Push: encrypts for the device and signs with VAPID) | token, tag, alert keys (iOS) | APNs, FCM or the UnifiedPush server |
| 5 | APNs / FCM / UnifiedPush | delivers | tag (and alert keys) | the device |
| 6 | Device / app | shows "You have new messages". On a tap the app looks up the tag in its own `hub_id` → {pushkey, tag} list, made at registration, and opens that hub. There's no `event_id`: the opened hub syncs with its own hub as usual and shows the new messages. | | |

If a token is no longer valid, PHC answers `rejected` the same way back, and the hub's Synapse
deletes the pusher.

**Sends the push:** PHC. The transcryptor relays, the hub only filters. **Holds the Apple/Google
keys:** only PHC.

#### Improvement: a different-looking tag on every push

As above, Apple and Google see the same tag every time a hub pushes to a device. Together with
the token, that tells them:

- how many hubs a device uses: the number of different tags per token;
- which pushes come from the same hub, and when, even without knowing which hub;
- with luck, which hub it is: if a hub's activity is visible (a busy event, a public room), its
  pushes can be matched to one tag, and from then on that tag is recognised.

PHC sees the same, since it decrypts the token and the tag.

The fix: PHC encrypts the tag again for every push, with a key only the app and PHC have.

| # | Who | Does | Sends | To | Stores |
|---|---|---|---|---|---|
| Registration | App | also makes a random `tag_key` (one per device), and puts it in every blob next to the token and the tag | blob = Enc_PHC(token, tag, `tag_key`) | each hub | App: `tag_key` |
| Push 4 | PHC | decrypts the blob, encrypts the tag with `tag_key` and a fresh random nonce (AES-GCM) | token, `sealed_tag` = nonce ‖ AES-GCM(`tag_key`, tag), alert keys | APNs, FCM | |
| Push 6 | App | decrypts `sealed_tag` with `tag_key`, then looks up the tag as before | | | |

Every push now carries different random bytes, so Apple and Google learn only **when** a device
gets a push. They can no longer count its hubs or group its pushes by hub. That is as private as C
towards Apple and Google, without C's battery cost and app changes. On iOS the alert still comes
from the app's strings, so iOS can show it without waking the app. The app only needs the tag on a
tap.

What it doesn't change:

- **PHC** still sees the token and the plain tag, so it can still count a device's hubs and group
  its pushes. Only C hides that from PHC.
- **Web Push (F-Droid)** already gets this: there, PHC encrypts the whole push for the device (RFC
  8291), so the UnifiedPush server never sees the tag.

Cost: about 30–50 lines in PHC and the app, and one more value in the blob format.

### C. Empty wake-up push, details fetched on the device

```
app ──pushers/set {random pushkey, blob = Enc_PHC(token)}──▶ every hub   (no tag)

hub's Synapse ──▶ hub's push gateway ──▶ transcryptor ──▶ PHC     (as B: event_id and room_id stop
                                                                   at the gateway, no hub_id anywhere)
PHC: several pushes for one token within a short window → one push
PHC ──{token, empty}──▶ Apple / Google / UnifiedPush ──{empty}──▶ device
device: extension / worker ──"what's new?" with each hub's session──▶ every hub
        ◀── unread rooms, counts ── every hub
        ─▶ notification "New messages in Hub X", badge
```

Registration: as B, but the blob holds only the token, no tag. The app also keeps each hub's
session where its Notification Service Extension (iOS) or worker (Android) can reach it, such as a
shared keychain.

Push:

| # | Who | Does | Sends | To |
|---|---|---|---|---|
| 1–3 | Synapse, push gateway, transcryptor | as B | blob, prio | PHC |
| 4 | PHC | decrypts the blob, collapses pushes for the same token within a short window | token, an empty push (iOS: `mutable-content`) | APNs, FCM or the UnifiedPush server |
| 5 | APNs / FCM / UnifiedPush | delivers | nothing but the wake-up: no `hub_id`, `event_id` or tag | the device |
| 6 | Extension / worker (app) | asks every hub it's logged in to what's new, with that hub's session (iOS gives about 30 s) | the hub's access token | every hub |
| 7 | Every hub | answers as for any client. `room_id`s and `event_id`s now go straight from the hub to the device, encrypted with TLS, as in normal use. | unread rooms, counts, new events | the device |
| 8 | Extension / worker (app) | builds the notification and badge. It knows the hub because it asked that hub. | | shown to the user |

**Sends the push:** PHC, as in B. **Decides what it says:** the app on the device. **Holds the
Apple/Google keys:** only PHC.

### F. No push provider

```
iOS and Play build (polling):
OS wakes the app when it decides ─▶ app ──"what's new?"──▶ every hub ─▶ local notification

F-Droid build (UnifiedPush, a separate endpoint per hub):
app ──pushers/set {pushkey = endpoint for this hub}──▶ each hub
hub's Synapse ──{endpoint, room_id, event_id, …}──▶ (hub proxy that removes room_id and event_id, or not)
              ──▶ distributor server (e.g. ntfy) ──▶ distributor app ──▶ PubHubs app ─▶ local notification
```

Registration:

| # | Who | Does | Sends | To | Stores |
|---|---|---|---|---|---|
| 1 | App (iOS, Play) | asks the OS for background time: iOS background refresh, Android WorkManager (every 15 minutes at most) | | the OS | |
| 1 | App (F-Droid) | asks the distributor for **a separate endpoint per hub** | | distributor app | |
| 2 | App (F-Droid) | registers a pusher on each hub with that hub's endpoint | `pushkey` = the endpoint, gateway = the distributor's Matrix gateway or a hub proxy | each hub | Hub: an endpoint no other hub has |

Push, iOS and Play build:

| # | Who | Does | Sends | To |
|---|---|---|---|---|
| 1 | OS | wakes the app when it decides (iOS: rarely for apps the user seldom opens) | | app |
| 2 | App | asks every hub what's new, as in normal use | the hub's access token | every hub |
| 3 | App | shows a local notification if there's something new | | the user |

Push, F-Droid build:

| # | Who | Does | Sends | To |
|---|---|---|---|---|
| 1 | Synapse (hub) | sees a new event for the user | endpoint, room_id, event_id, counts | the distributor's Matrix gateway, or a hub proxy that drops the IDs first |
| 2 | Distributor server (e.g. ntfy) | delivers | room_id and event_id, unless a hub proxy removed them | distributor app on the device |
| 3 | Distributor app | hands the push to the PubHubs app | | PubHubs app |
| 4 | PubHubs app | knows the hub by the endpoint the push came in on (no `hub_id` needed), shows a local notification | | the user |

**Sends the push:** nobody (polling), or the hub through the user's distributor (F-Droid). No
central PubHubs server, no Apple/Google keys.

## Comparison

| | A. Sygnal in each hub                                        | **B. PHC sends, transcryptor relays** | **C. Empty wake-up, fetch on device** | **F. No push provider** |
|---|---|---|---|---|
| **Privacy: can hubs link users?** | **Yes.** Every hub gets the same raw device token as `pushkey`. | No. Random `pushkey`, a different blob for each hub. | No, as B. | No, with a separate UnifiedPush endpoint per hub. Polling has nothing to link. |
| **Privacy: what Apple and Google learn** | Which hubs a device uses (a fixed `hub_id` in every push), and when. | When a device gets a push, and a fixed random tag per device and hub. So: how many hubs a device uses, and which of its pushes come from the same hub (not which hub). **With [the improvement](#improvement-a-different-looking-tag-on-every-push): only when.** Web Push: only when. | Only that a device gets a push. No tag at all. | Nothing. |
| **Privacy: what PHC learns** | Nothing. | Push tokens, and the fixed tags: how many hubs each device uses, and which pushes come from the same hub, not which hub. Also with the improvement. Linking the hubs needs PHC and the transcryptor together. | Push tokens only, not how many hubs. | Nothing. |
| **Privacy: timing** | A hub's push reaches Apple or Google immediately. | The transcryptor relays immediately, so PHC sees each push the moment the hub sends it. | As B. Also, all of a device's hubs get asked at the same moment. | When the device polls each hub, as in normal use of the app. |
| **Code in each hub** | ~220 lines: a proxy that removes content, Sygnal startup and Dockerfile, Sygnal config. **Plus Sygnal itself**, an extra dependency in its own venv. | ~100 lines: a proxy that passes on only the blob. | ~100, as B. | **None** with ntfy as the push gateway, but then the distributor sees room and event IDs. Otherwise ~100 for a proxy that removes them. |
| **Running a hub** | Run Sygnal, and hold the Apple/Google key (`.p8`). | Nothing to set up. | Nothing to set up. | Nothing to set up. |
| **Code in PHC and the transcryptor** | ~515 lines: an endpoint that gives hubs short-lived Apple/Google tokens. **No hub uses it yet**, and Sygnal can't use it without a patch. | ~1,125 lines: PHC's own sender (~890) that decrypts blobs and sends to APNs, FCM and Web Push (VAPID, RFC 8291), plus config, API and the transcryptor relay (~35). The improvement adds ~30–50 in PHC and the app. | ~1,100, about as B: no tag, but collapsing of pushes. | **None.** |
| **Code in the app** | ~255 lines TypeScript (`nativePush.ts`) and ~900 native: the iOS plugin, Android FCM, UnifiedPush and notifications. | ~360 lines TypeScript (adds the blob encryption, `pushBlob.ts`) and ~750 native. | B plus **~500–800 Swift** for an iOS Notification Service Extension (a new target, hub sessions in a shared keychain, fetching from each hub), and ~300 for Android. **The largest app change.** | ~300–500: iOS background refresh, Android WorkManager polling, a UnifiedPush endpoint per hub. The FCM and APNs code goes. |
| **Experience** | An immediate "You have new messages". Tapping it opens the right hub. | As A. | A few seconds later, but it says more: "New messages in Hub X", and the badge shows the right count. | iOS: **15 minutes to hours late, or not at all** for apps the user rarely opens. Android Play build: at least 15 minutes. F-Droid build: immediate. |
| **Battery and data** | Very little. iOS shows the notification without waking the app; Android wakes it briefly. | As A. | **More.** Every push wakes the app, which asks every hub it's logged in to (iOS gives it about 30 s). | **Low to moderate.** Regular requests to every hub, also when nothing happened. iOS limits how often, which is why notifications are so late. |
| **Depends on a central server** | No. | Every push goes through PHC and the transcryptor. If either is down, there are no pushes. | As B. | No. |
| **Abuse** | Every hub holds the network-wide key, so any hub can push to any PubHubs user. | The transcryptor's `.ph/push` is unauthenticated: anyone with a blob can push to that device, and the endpoint can be flooded. It needs a hub ticket and a rate limit. | As B, with less harm (an empty push). | Nothing new to abuse. |
| **Platforms** | iOS, Android (Play and F-Droid). | iOS, Android (Play and F-Droid). | iOS, Android (Play and F-Droid). | Only the F-Droid build gets notifications on time. On iOS there are effectively none. |
| **Our own crypto** | None. | Our own blob format, Web Push encryption and VAPID, and with the improvement the sealed tag. Classical, not post-quantum like the keys between the servers. | As B. | None. |

## Conclusions

We chose B, maybe with C later. See [Decision](#decision).

- **A** needs the least central code, but it lets hubs link users, and in practice every hub
  holds the network-wide key.
- **B** gives much better privacy with the same experience and battery use. It puts the code in PHC,
  and pushes depend on central servers. With the improvement (a different-looking tag on every
  push), Apple and Google learn as little as in C.
- **C** says more in its notifications and hides from PHC how many hubs a device uses. It costs
  battery and the largest change to the app.
- **F** needs the least code and gives the best privacy, but on iOS notifications come too late to
  rely on. It fits as a fallback or an opt-in privacy mode.
