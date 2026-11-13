"""Tests that deactivating an account ends it for good.

Deactivation erases the account and then unlinks it from the hub pseudonym it was registered
under, so entering the hub again registers a fresh matrix user instead of resurrecting the old
one.  Resurrecting it would undo the erasure -- `activate_account` clears the erased flag, and
every message the account ever sent becomes readable again.
"""

import sqlite3
from types import SimpleNamespace
from unittest import IsolatedAsyncioTestCase
from unittest.mock import patch

import sys

from synapse.storage.engines import Sqlite3Engine

sys.path.append("modules")
from pubhubs._store import HubStore
from pubhubs.Core import _NOT_LOADED, MAX_DEACTIVATION_ATTEMPTS, Config, Core, PhDeactivateCompleteEP, deactivate_deleted

USER = "@user:domain"
OTHER_USER = "@other:domain"
ROOM = "!secured:domain"
HHP = "hashed-hub-pseudonym"


class FakeTransaction:
    """A sqlite3 cursor plus the `database_engine` HubStore branches on for dialect-specific SQL."""

    # Bypasses __init__, which needs a full Synapse database config; isinstance is all HubStore uses.
    database_engine = Sqlite3Engine.__new__(Sqlite3Engine)

    def __init__(self, cursor):
        self._cursor = cursor

    def __getattr__(self, name):
        return getattr(self._cursor, name)


class SqliteModuleApi:
    """Runs HubStore's transactions against an in-memory sqlite database."""

    def __init__(self):
        self.connection = sqlite3.connect(":memory:")

    async def run_db_interaction(self, desc, func, *args, **kwargs):
        cursor = self.connection.cursor()
        try:
            result = func(FakeTransaction(cursor), *args, **kwargs)
            self.connection.commit()
            return result
        finally:
            cursor.close()


class DeleteUserRowsTestCase(IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.module_api = SqliteModuleApi()
        self.store = HubStore(self.module_api, {})
        await self.store.create_tables()

        for user in (USER, OTHER_USER):
            self.module_api.connection.execute(
                "INSERT INTO allowed_to_join_room (user_id, room_id) VALUES (?, ?)",
                (user, ROOM),
            )
            self.module_api.connection.execute(
                "INSERT INTO joined_hub (user_id) VALUES (?)", (user,)
            )
        self.module_api.connection.commit()

    def rows_of(self, table, user):
        return self.module_api.connection.execute(
            f"SELECT 1 FROM {table} WHERE user_id = ?", (user,)
        ).fetchall()

    async def test_deletes_only_the_given_users_rows(self):
        await self.store.delete_user_rows(USER)

        self.assertEqual(self.rows_of("allowed_to_join_room", USER), [])
        self.assertEqual(self.rows_of("joined_hub", USER), [])

        # The hub is shared; another member's access must survive.
        self.assertEqual(len(self.rows_of("allowed_to_join_room", OTHER_USER)), 1)
        self.assertEqual(len(self.rows_of("joined_hub", OTHER_USER)), 1)

    async def test_deleting_twice_is_not_an_error(self):
        await self.store.delete_user_rows(USER)
        await self.store.delete_user_rows(USER)

        self.assertEqual(self.rows_of("joined_hub", USER), [])


class DeactivatedUsersTestCase(IsolatedAsyncioTestCase):
    """The lookup clients use to tell a deleted account from a member who merely left."""

    async def asyncSetUp(self):
        self.module_api = SqliteModuleApi()
        self.store = HubStore(self.module_api, {})
        # `users` is Synapse's own table; only the columns this query touches are needed.
        self.module_api.connection.execute(
            "CREATE TABLE users (name TEXT NOT NULL, deactivated INT NOT NULL DEFAULT 0)"
        )
        self.module_api.connection.executemany(
            "INSERT INTO users (name, deactivated) VALUES (?, ?)",
            [(USER, 1), (OTHER_USER, 0)],
        )
        self.module_api.connection.commit()

    async def test_reports_only_the_deactivated_ones(self):
        self.assertEqual(
            await self.store.get_deactivated_users([USER, OTHER_USER]), [USER]
        )

    async def test_a_user_it_has_never_heard_of_is_not_deactivated(self):
        # Rather than an error: a client asking about someone who was never on this hub gets
        # the same answer as for a live member, and shows them as they are.
        self.assertEqual(await self.store.get_deactivated_users(["@nobody:domain"]), [])

    async def test_asking_about_nobody_hits_no_database(self):
        # An empty IN clause is not valid SQL, and the `users` table is not even needed here.
        self.assertEqual(await self.store.get_deactivated_users([]), [])


class FakeRequester:
    def __init__(self, mxid):
        self.user = self
        self._mxid = mxid

    def to_string(self):
        return self._mxid


class FakeSynapseStore:
    """The bits of Synapse's datastore that deactivate-complete touches."""

    def __init__(self, external_ids):
        self.external_ids = dict(external_ids)
        self.remove_calls = []
        self.fail_to_remove = False

    async def get_user_by_external_id(self, auth_provider, external_id):
        return self.external_ids.get((auth_provider, external_id))

    async def remove_user_external_id(self, auth_provider, external_id, user_id):
        self.remove_calls.append((auth_provider, external_id, user_id))
        if self.fail_to_remove:
            raise RuntimeError("object store is having a bad day")
        self.external_ids.pop((auth_provider, external_id), None)


class FakeDeactivateHandler:
    def __init__(self):
        self.calls = []

    async def deactivate_account(self, mxid, erase_data, requester, by_admin):
        self.calls.append({"mxid": mxid, "erase_data": erase_data, "by_admin": by_admin})


class FakeHomeserver:
    def __init__(self, deactivate_handler):
        self._deactivate_handler = deactivate_handler

    def get_deactivate_account_handler(self):
        return self._deactivate_handler


class FakeModuleApi:
    def __init__(self, store, homeserver, requester):
        self._store = store
        self._hs = homeserver
        self._requester = requester

    async def get_user_by_req(self, request):
        if self._requester is None:
            raise RuntimeError("no access token")
        return self._requester


class FakeHubStore:
    def __init__(self):
        self.deleted_users = []

    async def delete_user_rows(self, user_id):
        self.deleted_users.append(user_id)


class FakeCore:
    def __init__(self, api, store):
        self._api = api
        self._store = store
        self._deactivation_failures = {}


class DeactivateCompleteTestCase(IsolatedAsyncioTestCase):
    """The endpoint, with the hhpp verification stubbed out -- it has its own tests."""

    def setUp(self):
        self.synapse_store = FakeSynapseStore({("pubhubs", HHP): USER})
        self.deactivate_handler = FakeDeactivateHandler()
        self.hub_store = FakeHubStore()
        self.core = FakeCore(
            FakeModuleApi(
                self.synapse_store,
                FakeHomeserver(self.deactivate_handler),
                FakeRequester(USER),
            ),
            self.hub_store,
        )
        self.endpoint = PhDeactivateCompleteEP(self.core)

    async def render(self):
        with (
            patch("pubhubs.Core.parse_hhpp_body", return_value=("hhpp", "state")),
            patch("pubhubs.Core.verify_hhpp", return_value=HHP),
        ):
            return await self.endpoint._render_POST_async(request=None)

    async def test_erases_unlinks_and_clears_hub_data(self):
        result = await self.render()

        self.assertEqual(result, {"Ok": "Deactivated"})

        # Erased, and at the user's own request rather than an admin's.
        self.assertEqual(
            self.deactivate_handler.calls,
            [{"mxid": USER, "erase_data": True, "by_admin": False}],
        )

        # Unlinked, so the pseudonym no longer resolves to the erased account.
        self.assertEqual(self.synapse_store.remove_calls, [("pubhubs", HHP, USER)])
        self.assertIsNone(
            await self.synapse_store.get_user_by_external_id("pubhubs", HHP)
        )

        self.assertEqual(self.hub_store.deleted_users, [USER])

    async def test_reports_success_when_unlinking_fails(self):
        """The account is already erased by then, so telling the user to retry would be a lie."""
        self.synapse_store.fail_to_remove = True

        result = await self.render()

        self.assertEqual(result, {"Ok": "Deactivated"})
        # Still cleared the hub's own rows rather than giving up on the first failure.
        self.assertEqual(self.hub_store.deleted_users, [USER])

    async def test_refuses_a_pseudonym_belonging_to_someone_else(self):
        self.synapse_store.external_ids = {("pubhubs", HHP): OTHER_USER}

        result = await self.render()

        self.assertEqual(result, {"Err": "PseudonymMismatch"})
        self.assertEqual(self.deactivate_handler.calls, [])
        self.assertEqual(self.synapse_store.remove_calls, [])
        self.assertEqual(self.hub_store.deleted_users, [])

    async def test_refuses_an_unauthenticated_request(self):
        self.core._api._requester = None

        result = await self.render()

        self.assertEqual(result, {"Err": "Unauthorized"})
        self.assertEqual(self.deactivate_handler.calls, [])

    async def test_leaves_the_account_linked_when_erasing_fails(self):
        """Without the erasure there is nothing to hide, so the user can retry as they are."""

        async def boom(*args, **kwargs):
            raise RuntimeError("synapse is having a bad day")

        self.deactivate_handler.deactivate_account = boom

        result = await self.render()

        self.assertEqual(result, {"Err": "InternalError"})
        self.assertEqual(self.synapse_store.remove_calls, [])
        self.assertEqual(self.hub_store.deleted_users, [])


class DeactivateDeletedTestCase(IsolatedAsyncioTestCase):
    """Deactivating the accounts of users who deleted their PubHubs account, from PHC's list."""

    def setUp(self):
        self.synapse_store = FakeSynapseStore({("pubhubs", HHP): USER})
        self.deactivate_handler = FakeDeactivateHandler()
        self.hub_store = FakeHubStore()
        self.core = FakeCore(
            FakeModuleApi(self.synapse_store, FakeHomeserver(self.deactivate_handler), None),
            self.hub_store,
        )

    async def test_deactivates_ours_and_skips_the_rest(self):
        # PHC lists every hub's pseudonym of a deleted account, entered or not.
        deleted = [
            {"hashed_hub_pseudonym": "someone-who-never-came-here", "deleted_at": 100},
            {"hashed_hub_pseudonym": HHP, "deleted_at": 200},
        ]

        since = await deactivate_deleted(self.core, deleted, None)

        self.assertEqual(since, 200)
        self.assertEqual(
            self.deactivate_handler.calls,
            [{"mxid": USER, "erase_data": True, "by_admin": False}],
        )
        self.assertEqual(self.synapse_store.remove_calls, [("pubhubs", HHP, USER)])
        self.assertEqual(self.hub_store.deleted_users, [USER])

    async def test_seeing_an_entry_again_does_nothing(self):
        """`since` is inclusive, and a restart starts from scratch: entries come round again."""
        deleted = [{"hashed_hub_pseudonym": HHP, "deleted_at": 200}]

        await deactivate_deleted(self.core, deleted, None)
        since = await deactivate_deleted(self.core, deleted, 200)

        self.assertEqual(since, 200)
        self.assertEqual(len(self.deactivate_handler.calls), 1)

    async def test_stops_at_a_failure_so_it_is_asked_for_again(self):
        async def boom(*args, **kwargs):
            raise RuntimeError("synapse is having a bad day")

        self.deactivate_handler.deactivate_account = boom
        deleted = [
            {"hashed_hub_pseudonym": "someone-who-never-came-here", "deleted_at": 100},
            {"hashed_hub_pseudonym": HHP, "deleted_at": 200},
            {"hashed_hub_pseudonym": "yet-another", "deleted_at": 300},
        ]

        since = await deactivate_deleted(self.core, deleted, 50)

        self.assertEqual(since, 100)
        # Still linked, so the next round finds the account again.
        self.assertEqual(self.synapse_store.remove_calls, [])

    async def test_gives_up_on_an_account_that_keeps_failing(self):
        """One broken account must not hold up every deletion after it."""
        calls = []

        async def boom(*args, **kwargs):
            calls.append(kwargs)
            raise RuntimeError("synapse is having a bad day")

        self.deactivate_handler.deactivate_account = boom
        deleted = [
            {"hashed_hub_pseudonym": HHP, "deleted_at": 200},
            {"hashed_hub_pseudonym": "yet-another", "deleted_at": 300},
        ]

        for _ in range(MAX_DEACTIVATION_ATTEMPTS - 1):
            self.assertEqual(await deactivate_deleted(self.core, deleted, 100), 100)

        self.assertEqual(await deactivate_deleted(self.core, deleted, 100), 300)
        self.assertEqual(len(calls), MAX_DEACTIVATION_ATTEMPTS)
        self.assertEqual(self.core._deactivation_failures, {})

    async def test_nothing_new_keeps_the_cursor(self):
        self.assertEqual(await deactivate_deleted(self.core, [], 200), 200)
        self.assertIsNone(await deactivate_deleted(self.core, [], None))


class DeletedPseudonymsSinceStoreTestCase(IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.store = HubStore(SqliteModuleApi(), {})
        await self.store.create_tables()

    async def test_nothing_saved_yet(self):
        self.assertIsNone(await self.store.get_deleted_pseudonyms_since())

    async def test_saving_again_overwrites(self):
        await self.store.set_deleted_pseudonyms_since(100)
        await self.store.set_deleted_pseudonyms_since(200)

        self.assertEqual(await self.store.get_deleted_pseudonyms_since(), 200)


class FakeHttpClient:
    def __init__(self, deleted):
        self.deleted = deleted
        self.requests = []

    async def post_json_get_json(self, url, req):
        self.requests.append(req)
        return {"Ok": {"Success": {"deleted": self.deleted}}}


class DeactivateDeletedAccountsTestCase(IsolatedAsyncioTestCase):
    """The polling loop around `deactivate_deleted`: where it carries on from after a restart."""

    async def asyncSetUp(self):
        self.store = HubStore(SqliteModuleApi(), {})
        await self.store.create_tables()
        # None of these are ours, so only the cursor moves.
        self.http_client = FakeHttpClient([
            {"hashed_hub_pseudonym": "someone-who-never-came-here", "deleted_at": 200},
            {"hashed_hub_pseudonym": "yet-another", "deleted_at": 300},
        ])

    def start_hub(self):
        """A freshly started hub's Core, as far as the polling loop is concerned."""
        api = FakeModuleApi(FakeSynapseStore({}), None, None)
        api.http_client = self.http_client
        return SimpleNamespace(
            _config=Config(phc_url="http://phc/"),
            _api=api,
            _store=self.store,
            _deleted_pseudonyms_since=_NOT_LOADED,
        )

    async def poll(self, core):
        await Core.deactivate_deleted_accounts(core)

    async def test_first_ever_poll_asks_for_everything_and_saves_where_it_got(self):
        await self.poll(self.start_hub())

        self.assertEqual(self.http_client.requests, [{}])
        self.assertEqual(await self.store.get_deleted_pseudonyms_since(), 300)

    async def test_a_restart_carries_on_where_it_was(self):
        await self.poll(self.start_hub())
        await self.poll(self.start_hub())

        self.assertEqual(self.http_client.requests[1], {"since": 300})

    async def test_cannot_load_so_does_not_ask(self):
        # Rather than ask for everything: next round, the table is likely there.
        core = self.start_hub()
        core._store = HubStore(SqliteModuleApi(), {})  # no tables

        await self.poll(core)

        self.assertEqual(self.http_client.requests, [])
        self.assertIs(core._deleted_pseudonyms_since, _NOT_LOADED)

    async def test_cannot_save_carries_on_from_memory(self):
        core = self.start_hub()
        await self.poll(core)  # loads None, saves 300

        async def boom(since):
            raise RuntimeError("database is having a bad day")

        self.store.set_deleted_pseudonyms_since = boom
        self.http_client.deleted.append(
            {"hashed_hub_pseudonym": "a-third", "deleted_at": 400}
        )
        await self.poll(core)
        await self.poll(core)

        self.assertEqual(self.http_client.requests[2], {"since": 400})
