# Secured rooms

## Goal of YiviRoomJoiner module

Certain rooms will only be accessible after disclosing certain attributes in Yivi, this module makes that possible.

The rooms and the attributes are configured through the secured rooms endpoint on `/_synapse/client/secured_rooms`.

## Requirements

Two extra settings in homeserver.yaml are required to make the module work:
- Enable `server_notices` `system_mxid_localpart` to have a user making the waiting rooms
- `public_baseurl` needs to be set to something publicly reachable if you want to be able to use the proxied Yivi service. Unless your phone will reach the synapse server on the default public baseurl

As in all matrix settings with docker on mac 'host.docker.internal' works on linux replace with: '172.17.0.1'

## Endpoints

These endpoints are only accessible with a standard access token used by Synapse, only admins are authorised.

### `GET /_synapse/client/secured_rooms`

Will return a list of all secured rooms with their settings.

**Errors** Returns -
- `401 Forbidden` if no token or a non-admin is provided.

### `POST /_synapse/client/secured_rooms`

Create a new secured room. Example request body:

```json
{
	"room_name": "new secured room",
	"accepted": {
		"pbdf.sidn-pbdf.email.domain": {
			"accepted_values": [
				"ru.nl"
			],
			"profile": true
		}
	},
	"user_txt": "usertx",
	"type": "ph.messages.restricted"
}
```

`room_name` is the name of the room.

`accepted` is an object where the keys are Yivi attributes and the values are objects themselves with two keys:
- `accepted_values` is a list of allowed attribute values, if the list is empty all values are allowed.
- `profile` is a boolean whether other participants in the room will see the particular disclosed attribute values.

`user_txt` is some text that can explain to users about what to disclose. This is unused so far.

`type` is the typ of the room to create, for now 2 values are supported "ph.messages.restricted" (regular chat room)
and "ph.threaded.restricted" (a more forum-like room).


Will return the created room including a room id.

**Errors** Returns -
- `401 Forbidden` if no token or a non-admin is provided.
- `400 Bad Request` with a body of errors if the request body is malformed.

### `PUT /_synapse/client/secured_rooms`

Update a room with, for example:

```json
{
    "room_name": "updated name",
	"accepted": {
		"pbdf.sidn-pbdf.email.domain": {
			"accepted_values": [
				"ru.nl"
			],
			"profile": true
		}
	},
	"room_id": "!pVEtaikxFiGHXPbFOn:testhub.matrix.host",
	"type": "ph.messages.restricted",
	"user_txt": "usertx"
}
```

Returns the id of the updated room:
```json
{
	"modified": "!pVEtaikxFiGHXPbFOn:testhub.matrix.host"
}
```

**Errors** Returns -
- `401 Forbidden` if no token or a non-admin is provided.
- `400 Bad Request` with a body of errors if the request body is malformed or the room cannot be matched.

### `DELETE /_synapse/client/secured_rooms`

Delete a room including the matrix room, by removing all the users.

Requires the correct values for the room, for example:

```json
{
    "room_name": "updated name",
	"accepted": {
		"pbdf.sidn-pbdf.email.domain": {
			"accepted_values": [
				"ru.nl"
			],
			"profile": true
		}
	},
	"room_id": "!pVEtaikxFiGHXPbFOn:testhub.matrix.host",
	"type": "ph.messages.restricted",
	"user_txt": "usertx"
}
```

Returns the id of the deleted room:
```json
{
	"deleted": "!pVEtaikxFiGHXPbFOn:testhub.matrix.host"
}
```

**Errors** Returns -
- `401 Forbidden` if no token or a non-admin is provided.
- `400 Bad Request` with a body of errors if the request body is malformed or the room cannot be matched.

### `GET /_synapse/client/ph/yivi-endpoint/start` and `GET /_synapse/client/ph/yivi-endpoint/result`

The generic Yivi endpoints to use to get the session to the front end. See for an example: https://github.com/privacybydesign/irma-frontend-packages

### `/_synapse/client/yiviproxy`

Allow the front end session to check the session status.

## Used endpoints by this module

- /_synapse/client/ph/yivi-endpoint
- /_synapse/client/yiviproxy
- /_synapse/client/secured_rooms
