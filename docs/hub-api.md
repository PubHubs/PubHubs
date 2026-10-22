# Hub API

A hub is a Synapse server with the PubHubs modules in `pubhubs_hub/modules/pubhubs/`. Besides the
standard [Matrix API](https://spec.matrix.org/latest/), those modules add the endpoints below for
the PubHubs clients. The API of PubHubs Central is described in the rustdoc of the
[`api` module](../pubhubs/src/api/mod.rs), published at <https://rust.docs.pubhubs.net>, or locally
with:

```sh
cd pubhubs
cargo run doc --document-private-items --open
```

## Endpoints

All paths start with `/_synapse/client/`. "User" means any user with a Matrix access token, "admin"
a hub admin, and "moderator" a moderator of the room (a steward, in the code).

| Path                                                | Who                        | What it does                                                                           | Source                      |
| --------------------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------- | --------------------------- |
| `.ph/info`                                          | anyone                     | The hub's details for PubHubs Central                                                  | `Core.py`                   |
| `.ph/enter-start`, `.ph/enter-complete`             | anyone                     | Entering the hub with a pseudonym from PubHubs Central                                 | `Core.py`                   |
| `secured_rooms`                                     | admin                      | Create, list, update and delete secured rooms, see [below](#secured-rooms)             | `_secured_rooms_web.py`     |
| `secured_room/public_metadata?room_id=`             | user                       | What a secured room asks to disclose, for the join dialog                              | `_secured_rooms_web.py`     |
| `ph/yivi-endpoint/start`, `ph/yivi-endpoint/result` | user                       | The Yivi session for joining a secured room                                            | `_web.py`                   |
| `yiviproxy`                                         | anyone                     | Passes the Yivi app's session requests on to the Yivi server                           | `_yivi_proxy.py`            |
| `hub/settings`                                      | anyone reads, admin writes | The hub's settings as JSON                                                             | `_hub_settings_resource.py` |
| `hub/icon`, `hub/banner`, and `default-` versions   | anyone reads, admin writes | The hub's icon and banner                                                              | `_hub_media_resource.py`    |
| `hub/data?data=`                                    | user                       | Per-user hub data, such as timestamps                                                  | `_hub_data_resource.py`     |
| `notices`                                           | anyone                     | The id of the server notices user                                                      | `_secured_rooms_web.py`     |
| `videocall`                                         | user                       | A LiveKit token (`GET`) or a new call room (`POST`), see [Video calls](video-calls.md) | `_video_call_web.py`        |
| `steward/reports`, `steward/secured_rooms`          | moderator                  | Reports and secured room settings for the rooms they moderate                          | `_steward/`                 |

The modules are configured in `homeserver.yaml`; see
`pubhubs_hub/matrix_test_config/homeserver.yaml` for the main options.

## Secured rooms

A secured room can only be joined after disclosing certain Yivi attributes. The `HubClientApi`
module keeps their settings and checks the disclosures.

If the Yivi app on a phone can't reach the hub at its `public_baseurl`, set `public_yivi_url` in the
module's configuration to an address it can reach.

### `GET secured_rooms`

Lists all secured rooms with their settings.

### `POST secured_rooms`

Creates a secured room, and returns it with its `room_id`:

```json
{
	"name": "new secured room",
	"topic": "topic",
	"accepted": {
		"pbdf.sidn-pbdf.email.domain": {
			"accepted_values": ["ru.nl"],
			"profile": true
		}
	},
	"user_txt": "usertx",
	"expiration_time_days": 10,
	"type": "ph.messages.restricted"
}
```

| Key                    | Value                                                                                                                                                                                                                                                       |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`                 | The room's name                                                                                                                                                                                                                                             |
| `topic`                | The room's description                                                                                                                                                                                                                                      |
| `accepted`             | The Yivi attributes to disclose, by [attribute id](https://github.com/privacybydesign/pbdf-schememanager). `accepted_values` lists the values that are let in, or all of them when empty; `profile` says whether others in the room see the disclosed value |
| `user_txt`             | Text explaining what to disclose. Not used yet                                                                                                                                                                                                              |
| `expiration_time_days` | After how many days a member has to disclose again. Defaults to 182                                                                                                                                                                                         |
| `type`                 | `ph.messages.restricted` for a chat room, `ph.threading.restricted` for a forum-like room                                                                                                                                                                   |

A `room_id` in the body is refused.

### `PUT secured_rooms`

Updates a secured room: the same body, with the `room_id` of the room. The `type` can't change.
Returns `{"modified": "<room_id>"}`.

### `DELETE secured_rooms?room_id=<room_id>`

Deletes the secured room and shuts down its Matrix room. Returns `{"deleted": "<room_id>"}`.

### Errors

Without an access token the response is `401`, for a user who isn't an admin `403`. A body that
isn't valid JSON or has unknown keys gives `400` with an `error` field. A `room_id` that is missing,
supplied when creating, or not a secured room, or a change of `type`, gives `400` with an `errors`
field.
