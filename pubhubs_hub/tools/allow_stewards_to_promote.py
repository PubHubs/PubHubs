#!/usr/bin/env python3
#
# Brings the power levels of rooms created before these were set at room creation in line with new rooms:
#
# - "m.room.power_levels": 50, so stewards may appoint experts and other stewards. Older rooms still have
#   Synapse's default of 100, so only their room admin can change roles. The hub's SpamChecker still
#   limits stewards to changing users between user, expert and steward.
# - The videocall membership events at 0, so ordinary members can join a call. Older rooms fall back to
#   the state_default of 50, so members get a 403 and stay invisible in the call.
#
# Levels are only ever lowered, never raised. Direct message rooms are excluded.
#
# Only someone at the current level (normally a room admin) may change power levels, so the script uses
# the Synapse admin API to act as a joined local user with the highest power level in each room.
#
# Usage:
#   SYNAPSE_ADMIN_TOKEN=<access token of a hub admin> ./allow_stewards_to_promote.py https://hub.example.com
#   SYNAPSE_ADMIN_TOKEN=... ./allow_stewards_to_promote.py https://hub.example.com --apply
#
# Without --apply it only reports what it would change.
#
import argparse
import json
import logging
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

logger = logging.getLogger(__name__)

USER = 0
STEWARD = 50
POWER_LEVELS = "m.room.power_levels"
# Keep in sync with the power_level_content_override in hub-client/src/composables/useEditRoom.ts and
# pubhubs_hub/modules/pubhubs/_secured_rooms_class.py
MAX_EVENT_LEVELS = {
    POWER_LEVELS: STEWARD,
    "org.matrix.msc3401.call": USER,
    "org.matrix.msc3401.call.member": USER,
    "org.matrix.msc4143.rtc.member": USER,
}
# Synapse's default level for state events not listed in "events"
STATE_DEFAULT = 50
# Keep in sync with DirectRooms in hub-client/src/models/rooms/TBaseRoom.ts
DIRECT_ROOM_TYPES = {"ph.messages.dm", "ph.messages.group", "ph.messages.admin.contact", "ph.messages.steward.contact"}
# The tokens the script logs in with only need to live as long as one room update.
PUPPET_TOKEN_VALIDITY_MS = 5 * 60 * 1000


def parse_args():
    parser = argparse.ArgumentParser(description="Let stewards change roles and members join videocalls in existing rooms")
    parser.add_argument("homeserver", help="base url of the hub's Synapse, e.g. https://hub.example.com")
    parser.add_argument("--apply", action="store_true", help="actually update the rooms instead of only reporting")
    parser.add_argument(
        "--token",
        default=os.environ.get("SYNAPSE_ADMIN_TOKEN"),
        help="access token of a Synapse admin (defaults to $SYNAPSE_ADMIN_TOKEN)",
    )
    args = parser.parse_args()
    if not args.token:
        parser.error("no admin token given, use --token or set SYNAPSE_ADMIN_TOKEN")
    return args


class Synapse:
    def __init__(self, homeserver, token):
        self._homeserver = homeserver.rstrip("/")
        self._token = token

    def request(self, method, path, body=None, token=None):
        data = None if body is None else json.dumps(body).encode()
        request = urllib.request.Request(self._homeserver + path, data=data, method=method)
        request.add_header("Authorization", f"Bearer {token or self._token}")
        request.add_header("Content-Type", "application/json")
        try:
            with urllib.request.urlopen(request) as response:
                return json.loads(response.read() or b"{}")
        except urllib.error.HTTPError as e:
            raise RuntimeError(f"{method} {path} failed with {e.code}: {e.read().decode(errors='replace')}") from e

    def rooms(self):
        start = 0
        while True:
            page = self.request("GET", f"/_synapse/admin/v1/rooms?from={start}&limit=100")
            yield from page["rooms"]
            if "next_batch" not in page:
                return
            start = page["next_batch"]

    def state(self, room_id):
        return self.request("GET", f"/_synapse/admin/v1/rooms/{quote(room_id)}/state")["state"]

    def joined_members(self, room_id):
        return set(self.request("GET", f"/_synapse/admin/v1/rooms/{quote(room_id)}/members")["members"])

    def login_as(self, user_id):
        valid_until_ms = int(time.time() * 1000) + PUPPET_TOKEN_VALIDITY_MS
        body = {"valid_until_ms": valid_until_ms}
        return self.request("POST", f"/_synapse/admin/v1/users/{quote(user_id)}/login", body)["access_token"]

    def logout(self, token):
        self.request("POST", "/_matrix/client/v3/logout", {}, token=token)

    def set_power_levels(self, room_id, content, token):
        self.request("PUT", f"/_matrix/client/v3/rooms/{quote(room_id)}/state/{POWER_LEVELS}/", content, token=token)


def quote(value):
    return urllib.parse.quote(value, safe="")


class Program:
    def __init__(self, args):
        self._args = args
        self._synapse = Synapse(args.homeserver, args.token)
        self._counts = {"updated": 0, "already ok": 0, "skipped": 0, "failed": 0}

    def run(self):
        self._admin_user_id = self._synapse.request("GET", "/_matrix/client/v3/account/whoami")["user_id"]
        self._server_name = self._admin_user_id.split(":", 1)[1]

        for room in self._synapse.rooms():
            room_id = room["room_id"]
            try:
                self._counts[self.update_room(room_id, room.get("name") or room_id)] += 1
            except Exception as e:
                logger.error(f"{room_id}: {e}")
                self._counts["failed"] += 1

        summary = ", ".join(f"{count} {result}" for result, count in self._counts.items())
        logger.info(f"Done{'' if self._args.apply else ' (dry run, nothing changed)'}: {summary}")
        return self._counts["failed"] == 0

    def update_room(self, room_id, name):
        state = {(event["type"], event.get("state_key")): event for event in self._synapse.state(room_id)}

        room_type = state.get(("m.room.create", ""), {}).get("content", {}).get("type")
        if room_type in DIRECT_ROOM_TYPES:
            return "skipped"

        power_levels_event = state.get((POWER_LEVELS, ""))
        if power_levels_event is None:
            logger.warning(f"{name} ({room_id}): no power levels, skipping")
            return "skipped"
        content = power_levels_event["content"]
        events = content.get("events", {})
        state_default = content.get("state_default", STATE_DEFAULT)
        current_levels = {event_type: events.get(event_type, state_default) for event_type in MAX_EVENT_LEVELS}
        changes = {
            event_type: (current_levels[event_type], max_level)
            for event_type, max_level in MAX_EVENT_LEVELS.items()
            if current_levels[event_type] > max_level
        }
        if not changes:
            return "already ok"
        description = ", ".join(f"{event_type} from {old} to {new}" for event_type, (old, new) in changes.items())

        # Synapse requires the sender to be allowed to send power levels and to be at or above every old
        # level it changes.
        required_level = max(current_levels[POWER_LEVELS], *(old for old, _new in changes.values()))
        sender = self.find_sender(room_id, content, required_level)
        if sender is None:
            logger.warning(f"{name} ({room_id}): no joined local user at level {required_level} or higher, skipping")
            return "skipped"

        if not self._args.apply:
            logger.info(f"{name} ({room_id}): would lower {description} as {sender}")
            return "updated"

        new_levels = {event_type: new for event_type, (_old, new) in changes.items()}
        new_content = {**content, "events": {**events, **new_levels}}
        if sender == self._admin_user_id:
            # Synapse doesn't let admins log in as themselves, but then the admin token itself will do.
            self._synapse.set_power_levels(room_id, new_content, self._args.token)
        else:
            token = self._synapse.login_as(sender)
            try:
                self._synapse.set_power_levels(room_id, new_content, token)
            finally:
                self._synapse.logout(token)
        logger.info(f"{name} ({room_id}): lowered {description} as {sender}")
        return "updated"

    def find_sender(self, room_id, content, required_level):
        """The joined local user with the highest power level, if that level is high enough to change the event."""
        users = content.get("users", {})
        candidates = [
            user_id
            for user_id in self._synapse.joined_members(room_id)
            if user_id.endswith(f":{self._server_name}") and users.get(user_id, content.get("users_default", 0)) >= required_level
        ]
        if not candidates:
            return None
        # Prefer the admin running the script, so no extra login is needed.
        if self._admin_user_id in candidates:
            return self._admin_user_id
        return max(candidates, key=lambda user_id: users.get(user_id, 0))


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    sys.exit(0 if Program(parse_args()).run() else 1)
