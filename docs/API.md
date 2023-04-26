This file describes some of the HTTP end-points used by PubHubs central.

# Bar endpoints
The following endpoints are to be used by the bar.

**Authentication** Since the bar will via an iframe be served by PubHubs Central, we can for authentication of the bar rely on the cookie set by PubHubs Central after the end-user logs in. (*NB:* the `GET /bar/hubs` requires no authentication of the user.)

## Bar state
To allow the hub-selection-bar to have the same appearance accross different devices, we allow the bar to store and retrieve some state from PubHubs Central, using the [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API).  Currently, this will probably be a JSON-file, but in the future, we might want to consider encrypting this, so that PubHubs Central cannot inspect it.  (The problem here is how to move the user's encryption key between devices.)  Anyway, to PubHubs Central, this 'bar state' is some opaque `application/octet-stream`.


### `GET /bar/state`
Returns `200 Ok` with as body the current bar state for the present user (according to the `PHAccount` cookie). Includes an `ETag` header with an [ETag](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/ETag) for the current state (being the lowercase-hex encoding of the `sha256` of the current bar state enclosed by two double quotes, `"`.)

If the bar state has not previously been set, it will be the empty byte string, with `ETag: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"`.

**Errors** Returns `403 Forbidden` when no valid `PHAccount` cookie was provided.

### `PUT /bar/state`
Changes the current bar state for the present user to the body of the request, provided that an [`If-Match`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-Match)-header is send along with the current (and soon to be old) bar state ETag (obtained by a previous `GET /bar/state`, or `PUT /bar/state`.)  A `Content-Type: application/octet-stream`-header must also be added.

Return `204 No Content` upon success, with empty body, but including the new ETag via the `ETag`-header.

**Errors**  Returns - 
 - `403 Forbidden` when no valid `PHAccount` cookie was provided.
 - `400 Bad Request` when: 
   - No `If-Match` with a single ETag was provided; or
   - `Content-Type` was not set to  `application/octet-stream`;
 - `412 Precondition Failed` when the ETag from `If-Match` did not match the ETag of the current bar state.  This is to prevent the bar from accidentally overriding previous changes made from a different device.  

## Hubs
### `GET /bar/hubs`
Returns `200 Ok` with an `application/json` body consisting of an array of objects (one for each hub) with the following fields.
 - `name`;
 - `description`;
 - `client_uri`, the Hub's client location, to be loaded in an iframe of the global client.
