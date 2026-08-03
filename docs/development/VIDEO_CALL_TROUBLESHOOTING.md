# Video Calling: Flow and Troubleshooting

A living record of how video calling actually fits together, what has broken so far, and how to
diagnose the next failure quickly. For *production* LiveKit setup see
[LIVEKIT_DEPLOYMENT.md](./LIVEKIT_DEPLOYMENT.md); this document is about the local development
picture and about debugging.

Keep it updated when the flow changes or a new fault is found. Code is referenced by file and symbol
rather than line number, because line numbers go stale.

## The flow

Two independent layers carry a call. Confusing them is the main source of wasted debugging time:

| Layer | Carries | Breaks look like |
| --- | --- | --- |
| **Matrix** | who is in a call, and the timeline message others click to join | receiver never gets a join button |
| **LiveKit / WebRTC** | the actual audio and video | call connects, but you only see yourself |

### Caller

`MessageInput.vue` → `startVideocall()` → `videoCall.ts` → `startCall()`:

1. `pubhubs.addVideoCallMessage()` — sends an ordinary timeline message with
   `msgtype: pubhubs.videocall`. **This message is the only thing other participants render.**
2. `Room.createGroupCall()` — POSTs to the hub's video call endpoint (which creates the LiveKit
   room), then `client.createGroupCall()`, which sends the `org.matrix.msc3401.call` **state event**.
3. `Room.startMatrixRTC()` — starts the MatrixRTC session manager.
4. `connectToCall()` — GETs `{token, livekit_url}` from the hub, calls
   `rtc_session.joinRoomSession()`, then `livekit_room.connect(target_url, token)`.

Note that `startVideocall()` only navigates to the call page when `startCall()` returns `true`, and
every failure above either throws or returns `false`. **If the caller reached the call page, every
step above succeeded.** That single fact eliminates a lot of the search space — use it.

### Receiver

`RoomMessageBubble.vue` renders the timeline message via `MessageVideoCall.vue`, whose
`checkHasCallEnded()` decides whether to offer a join button. It has three exits, and two of them
produce the same visible result:

1. a related `VideoCallEnded` event exists → show a real duration
2. `isOldMessage` (this is not the newest call message) → `callEnded`, "Duration: Unknown"
3. otherwise poll `Room.isOngoingCall()` (i.e. `client.getGroupCallForRoom()`) five times at one
   second; if still nothing → `callEnded`, "Duration: Unknown"

`callEnded` **hides the join button**. So "Duration: Unknown with no join button" does not identify
which branch fired — instrument all three (see below).

An asymmetry worth remembering: `GroupCall.create()` in matrix-js-sdk registers the call in a local
map *before* sending the state event. The caller's own UI therefore shows an active call even if no
one else ever learns about it. **The caller's UI is not evidence that signalling worked.**

### Hub side

`pubhubs_hub/modules/pubhubs/_video_call_web.py`:

- `GET` — mints a LiveKit access token; identity is `authenticated_entity + ":" + device_id`
- `POST` — creates the LiveKit room
- both call `_may_use_video_call()`; secured rooms require an allow-list entry, room admins are
  exempted by power level

Only *secured* rooms get a `power_level_content_override` permitting normal users to send
`org.matrix.msc3401.call` / `.member` / `org.matrix.msc4143.rtc.member`
(see `_secured_rooms_class.py`). Ordinary rooms fall back to `state_default`, so this is a place to
look if a non-admin cannot start or join a call in a plain room.

## Ports in local development

Hub `n` (`mask run hub server <n>`) gets Synapse on `8008+n` and its own bundled LiveKit on
`7880+n`, published on the host loopback only.

LiveKit's port is deliberately the *same inside and outside* the container, set by a per-hub config
that `start_testhub.py` generates into `testhub<n>/livekit.yaml` and passes via
`LIVEKIT_CONFIG_PATH`, with a matching `LIVEKIT_URL`. Remapping instead (host `7880+n` → container
`7880`) does not work: `_video_call_web.py` hands the browser the same `LIVEKIT_URL` it uses for its
own server-side LiveKit API calls, so every hub would send browsers to hub 0's LiveKit. Since all dev
hubs share the committed `devkey`, such a token would even validate — media would silently flow
through the wrong hub, and break whenever hub 0 was not running.

The rtc media ports (UDP 50000-60000, TCP 7885) are identical in every container but are not
published, so they cannot collide.

## Known issues

### Fixed 2026-08-03 — receiver never got a join button

**Symptom.** The caller entered the call and saw their own video. Every other participant saw the
call message with "Duration: Unknown", no body text, and no join button.

**Cause.** `RoomMessageBubble` accepts three prop shapes (`TimelineEvent`, `MatrixEvent`, plain
`TMessageEvent`) and unwraps them in its `event` computed. Every child received the unwrapped value
except `MessageVideoCall`, which was passed `props.event as any` — the raw wrapper. For a
`TimelineEvent` the real event lives at `.matrixEvent.event`, so inside the component `event_id`,
`content.body` and `content.timestamp` were all `undefined`. That made

```js
const isOldMessage = props.event.event_id !== mostRecent?.event.event_id;
```

evaluate `undefined !== "$…"` → always true, so exit 2 fired for every receiver on every call. The
`as any` cast is what allowed it to compile.

**Fix.** A `videoCallEvent` computed derived from the unwrapped `event`, passed to both
`MessageVideoCall` usages, with the `as any` removed so the compiler catches a regression.
Covered by `hub-client/test/components/RoomMessageBubbleVideoCall.test.ts`.

**Lesson.** Nothing upstream was wrong — sliding sync delivered the state event and the receiver had
the group call registered. Before suspecting sync, the SDK, or power levels, confirm the receiver's
component is being handed a usable event.

### Not an issue — local remote media does work (open question why)

This was flagged as broken on 2026-08-03 on the strength of a port analysis, and then **contradicted
by testing the same day**: remote video works between two browsers on the host. Do not act on the
analysis below as though it were a defect.

What was actually verified: `docker port` shows only `127.0.0.1:7880` (LiveKit signalling) and
`8008` (Synapse) published; `pubhubs_hub/config/local/livekit.local.yaml` declares media on
**UDP 50000-60000** plus **TCP 7885**; and `use_external_ip: true` makes LiveKit advertise the
machine's own external address (visible in the container log as
`found external IP via STUN … externalIP: …`). The inference drawn from that — that ICE has nowhere
to send media — **was wrong.**

The path media actually takes has not been identified. Candidates not ruled out: a peer-to-peer
route that bypasses the SFU entirely (two browsers on one host makes that trivial), or Docker
Desktop networking behaviour the port table does not reflect. If local remote media ever *does*
fail, open `chrome://webrtc-internals` on both sides and look at the selected ICE candidate pair —
that answers in seconds what a port table cannot.

**Lesson: a port mapping table tells you what is published, not whether media flows.** Confirm with
a real call before calling the media path broken.

Should the SFU path ever genuinely need to be reachable from the host, the shape of the change is a
single mux port rather than publishing a 10,001-port range (Docker starts a proxy per port). This is
**unimplemented and unverified**:

```yaml
# pubhubs_hub/config/local/livekit.local.yaml
rtc:
  udp_port: 7882 # replaces port_range_start/port_range_end
  tcp_port: 7885
  use_external_ip: false
  node_ip: 127.0.0.1 # an address the host browser can actually reach
```

```python
# pubhubs_hub/start_testhub.py, alongside the existing 7880 mapping
"-p", "127.0.0.1:7882:7882/udp",
"-p", "127.0.0.1:7885:7885",
```

`--udp-port` and `--node-ip` are confirmed present in the bundled `livekit-server` binary.
`node_ip: 127.0.0.1` restricts calls to browsers on the host, which matches the loopback-only intent
of the committed dev key — but it makes this config strictly dev-only.

## Diagnostic recipe

For any "the other side doesn't see the call" report, instrument the receiver first. Drop this into
`MessageVideoCall.vue` and call `dbg('<branch name>')` at **every** exit of `checkHasCallEnded()`,
including an `enter` at the top — a log at only one exit will stay silent when a different branch
fires, which reads misleadingly like "no logs, so the component never runs".

```ts
function dbg(reason: string, extra: Record<string, unknown> = {}) {
    const client = currentRoom?.matrixRoom.client;
    const handler = client?.groupCallEventHandler;
    const callStateEvents = currentRoom?.matrixRoom.currentState.getStateEvents('org.matrix.msc3401.call') ?? [];

    // eslint-disable-next-line no-console
    console.log(
        '[videocall-debug] ' +
            JSON.stringify({
                reason,
                ...extra,
                // false => supportsMatrixCall() was false, so the handler never started
                handlerExists: !!handler,
                syncState: client?.getSyncState() ?? null,
                registeredGroupCalls: handler ? handler.groupCalls.size : null,
                // did the org.matrix.msc3401.call state event reach this client at all?
                callStateEventCount: callStateEvents.length,
                callStateEvents: callStateEvents.map((e) => ({
                    stateKey: e.getStateKey(),
                    terminated: !!e.getContent()['m.terminated'],
                    ts: e.getTs(),
                })),
                groupCallForRoom: handler ? (handler.groupCalls.get(props.roomId)?.groupCallId ?? null) : null,
                eventId: props.event.event_id,
                me: client?.getUserId() ?? null,
            }),
    );
}
```

One flat JSON string per line, so it can be filtered (`videocall-debug`) and copied out of a busy
console. Watch for **absent** keys: `JSON.stringify` omits `undefined`, which is exactly how the
missing `event_id` above revealed itself.

Reading the output:

| Observation | Meaning |
| --- | --- |
| `reason: "exit:isOldMessage"` with no `eventId` key | the receiver's event has no `event_id` — the bug fixed above |
| `callStateEventCount: 0` | the `org.matrix.msc3401.call` state event never reached this client; check sliding sync `required_state` in `hub-client/src/logic/matrix.logic.ts` |
| `handlerExists: false` | `supportsMatrixCall()` was false, so no call is ever visible to this client — check secure context |
| `syncState` not `"SYNCING"` | `GroupCallEventHandler.start()` waits for this state and never attached its listener |
| `groupCallForRoom` set, but no remote media | Matrix layer is fine; this is the WebRTC media path — go to `chrome://webrtc-internals`, not to this component |

The client is served by Vite, so these edits hot-reload; no container restart is needed for
hub-client changes.
