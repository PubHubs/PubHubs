# Video calls

How video calling fits together, what has gone wrong before, and how to diagnose the next failure
quickly. For setting up LiveKit for a hub in production, see
[Running a hub](running-a-hub.md#video-calls); this page is about local development and debugging.

Keep it updated when the flow changes or a new fault is found. Code is referenced by file and symbol
rather than line number, because line numbers go stale.

## The flow

Two independent layers carry a call. Confusing them is the main source of wasted debugging time:

| Layer                | Carries                                                                                 | Breaks look like                         |
| -------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------- |
| **Matrix**           | who is in a call (MatrixRTC memberships), and the timeline message others click to join | receiver never gets a join button        |
| **LiveKit / WebRTC** | the actual audio and video                                                              | call connects, but you only see yourself |

### Caller

1. `startVideocall()` in `MessageInput.vue` calls `startCall()` in `stores/videoCall.ts`, which only
   calls `Room.initializeCall()`: a `POST` to the hub's `videocall` endpoint, which checks the user
   and creates the LiveKit room. When that succeeds, the client opens the call page.
2. On the call page (`VideoCallPage.vue`) the user picks a camera and microphone and joins, which
   calls `joinCall()` and from there `connectToCall()`:
    1. `Room.getLiveKitTokenResponse()` gets `{token, livekit_url}` from the hub (`GET videocall`).
    2. `rtc_session.joinRTCSession()` on the room's MatrixRTC session sends this device's
       `org.matrix.msc3401.call.member` **state event**. This is how others learn who is in the
       call.
    3. `livekit_room.connect(target_url, token)` connects the media.
3. Back in `joinCall()`, if the session then has exactly one membership (you started the call),
   `pubhubs.addVideoCallMessage()` sends a timeline message with `msgtype: pubhubs.videocall`.
   **This message is what other participants render, and click to join.** Joining and leaving are
   posted in its thread.
4. `leaveCall()` leaves the session; the last one out sends a `pubhubs.videocall.ended` message
   related to the call message. When the memberships drop to zero, everyone still on the call page
   is sent back to the room.

Reaching the call page only proves step 1: the timeline message and the membership are sent after
the user joins, from step 2 on. **The caller's own call page is not evidence that anyone else can
see the call.**

### Receiver

`RoomMessageBubble.vue` renders the call message with `MessageVideoCall.vue`, whose
`checkHasCallEnded()` decides whether to offer a join button. It runs when the message is shown,
when related events change, and on every `MembershipsChanged` of the room's MatrixRTC session. It
has three exits that end the call, and two of them look the same:

1. a related `pubhubs.videocall.ended` message exists → the real duration
2. `isOldMessage` (this is not the newest call message in the live timeline) → "Duration: Unknown"
3. `Room.hasActiveCall()` is false, i.e. the MatrixRTC session has no memberships → "Duration:
   Unknown"

Otherwise it shows the join button, which opens the call page; joining there is step 2 above. An
ended call **hides the join button**. So "Duration: Unknown with no join button" does not identify
which branch fired; instrument all three (see below).

### Hub side

`pubhubs_hub/modules/pubhubs/_video_call_web.py`:

- `GET` mints a LiveKit access token; identity is `authenticated_entity + ":" + device_id`
- `POST` creates the LiveKit room
- both call `_may_use_video_call()`; secured rooms require an allow-list entry, room admins are
  exempted by power level

Normal users may only send the call events (`org.matrix.msc3401.call`, `.member` and
`org.matrix.msc4143.rtc.member`) where the room's power levels allow it. Secured rooms
(`_secured_rooms_class.py`) and rooms created from the hub client (`composables/useEditRoom.ts`) set
that at creation. Older rooms and direct messages fall back to `state_default`, so this is a place
to look if a non-admin cannot start or join a call there.

## Ports in local development

Hub `n` (`mask run hub server <n>`) gets Synapse on `8008+n` and its own bundled LiveKit on
`7880+n`, published on the host loopback only.

LiveKit's port is deliberately the _same inside and outside_ the container, set by a per-hub config
that `start_testhub.py` generates into `testhub<n>/livekit.yaml` and passes via
`LIVEKIT_CONFIG_PATH`, with a matching `LIVEKIT_URL`. Remapping instead (host `7880+n` → container
`7880`) does not work: `_video_call_web.py` hands the browser the same `LIVEKIT_URL` it uses for its
own server-side LiveKit API calls, so every hub would send browsers to hub 0's LiveKit. Since all
dev hubs share the committed `devkey`, such a token would even validate — media would silently flow
through the wrong hub, and break whenever hub 0 was not running.

The rtc media ports (UDP 50000-60000, TCP 7885) are identical in every container but are not
published, so they cannot collide.

## Pitfalls

- **Check that the receiver gets a usable event first.** Receivers once never got a join button:
  `RoomMessageBubble` passed `MessageVideoCall` the `TimelineEvent` wrapper instead of the unwrapped
  event, so `event_id` was `undefined` and every call counted as an old message (exit 2 above).
  Sync, the SDK and power levels were all fine.
  `hub-client/test/components/RoomMessageBubbleVideoCall.test.ts` covers it now.
- **A port table tells you what is published, not whether media flows.** Locally only LiveKit's
  signalling port and Synapse are published, not LiveKit's media ports (UDP 50000-60000 and TCP
  7885, see `pubhubs_hub/config/local/livekit.local.yaml`), and yet remote video works between two
  browsers on the host. Which path the media takes hasn't been worked out. If local media ever does
  fail, look at the selected ICE candidate pair in `chrome://webrtc-internals` on both sides.
- **If the SFU ever needs to be reachable from the host**, publish one mux port rather than the
  whole range (Docker starts a proxy per port). Untested:

    ```yaml
    # pubhubs_hub/config/local/livekit.local.yaml
    rtc:
      udp_port: 7882 # replaces port_range_start/port_range_end
      tcp_port: 7885
      use_external_ip: false
      node_ip: 127.0.0.1 # an address the host browser can reach; dev only
    ```

    with `-p 127.0.0.1:7882:7882/udp` and `-p 127.0.0.1:7885:7885` next to the 7880 mapping in
    `pubhubs_hub/start_testhub.py`.

## Diagnostic recipe

For any "the other side doesn't see the call" report, instrument the receiver first. Drop this into
`MessageVideoCall.vue` and call `dbg('<branch name>')` at **every** exit of `checkHasCallEnded()`,
including an `enter` at the top. A log at only one exit stays silent when a different branch fires,
which reads misleadingly like "no logs, so the component never runs".

```ts
function dbg(reason: string) {
	const client = currentRoom?.matrixRoom.client;
	const memberStateEvents =
		currentRoom?.matrixRoom.currentState.getStateEvents('org.matrix.msc3401.call.member') ?? [];

	// eslint-disable-next-line no-console
	console.log(
		'[videocall-debug] ' +
			JSON.stringify({
				reason,
				eventId: props.event.event_id,
				newestCallEventId: currentRoom?.getLastVideoCallTimeLineEvent()?.event.event_id,
				// memberships the SDK counts; hasActiveCall() is memberships > 0
				memberships: rtcSession?.memberships.length ?? null,
				// did the membership state events reach this client at all?
				memberStateEvents: memberStateEvents.map((e) => ({
					stateKey: e.getStateKey(),
					ts: e.getTs(),
				})),
				syncState: client?.getSyncState() ?? null,
				me: client?.getUserId() ?? null,
			}),
	);
}
```

One flat JSON string per line, so it can be filtered (`videocall-debug`) and copied out of a busy
console. Watch for **absent** keys: `JSON.stringify` omits `undefined`, which is exactly how the
missing `event_id` in the first pitfall revealed itself.

Reading the output:

| Observation                                                     | Meaning                                                                                                                                                   |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `isOldMessage` exit with no `eventId` key                       | the receiver's event has no `event_id`, the first pitfall above                                                                                           |
| `isOldMessage` exit, `eventId` differs from `newestCallEventId` | a newer call message exists, or this client's live timeline doesn't have the newest one                                                                   |
| `memberStateEvents: []`                                         | the membership state events never reached this client; check that sliding sync's `required_state` in `hub-client/src/logic/matrix.logic.ts` asks for them |
| `memberStateEvents` present, `memberships: 0`                   | the events arrived, but the SDK doesn't count them as current memberships, for example because they expired                                               |
| no call message in the timeline at all                          | the caller never got to `addVideoCallMessage()`: they didn't join, or the session didn't have exactly one membership right after joining                  |
| join button shown, but no remote media                          | the Matrix layer is fine; this is the WebRTC media path, so go to `chrome://webrtc-internals`, not to this component                                      |

The client is served by Vite, so these edits hot-reload; no container restart is needed for
hub-client changes.
