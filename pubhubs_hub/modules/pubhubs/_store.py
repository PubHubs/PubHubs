import json
import logging
import secrets
import string
import time
from typing import Optional

from synapse.module_api import ModuleApi
from synapse.storage.database import LoggingTransaction

from ._secured_rooms_class import SecuredRoom, RoomAttributeEncoder, RoomAttribute

logger = logging.getLogger(__name__)

TOKEN_DURATION = 24 * 60 * 60


def _generate_token() -> (str, int):
    now = int(time.time())
    token = f"{now}".join(secrets.choice(string.ascii_letters)
                          for _ in range(22))
    token_expiration = now + TOKEN_DURATION
    return token, token_expiration


class YiviRoomJoinStore:
    """Contains methods for database operations connected to room access with Yivi.
    """

    def __init__(self, module_api: ModuleApi):
        self.module_api = module_api

    async def create_tables(self):
        """Creates the necessary tables for allowing users access using Yivi.
        """

        def create_tables_txn(txn: LoggingTransaction):
            # No functionality yet for expired Yivi attributes, now able to join room forever.
            # Make some background check for it see: https://github.com/matrix-org/synapse-email-account-validity for an example.
            txn.execute(
                """
                CREATE TABLE IF NOT EXISTS allowed_to_join_room(
                    user_id TEXT NOT NULL,
                    room_id TEXT NOT NULL
                )
                """,
                (),
            )

            txn.execute(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS allowed_user_room_idx
                    ON allowed_to_join_room(user_id, room_id)
                """,
                (),
            )

            txn.execute(
                """
                CREATE TABLE IF NOT EXISTS secured_rooms(
                    room_id TEXT NOT NULL,
                    accepted TEXT NOT NULL,
                    user_txt TEXT
                )
                """,
                (),
            )

            txn.execute(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS secured_rooms_id_idx
                    ON secured_rooms(room_id)
                """,
                (),
            )

        await self.module_api.run_db_interaction(
            "allowed_and_secured_rooms_create_tables",
            create_tables_txn,
        )

    async def is_allowed(self, user_id: str, room_id: str) -> bool:
        """Check whether a user is allowed to join a room.

        :param user_id: The user that wants to join the room
        :param room_id: The room the user wants to join
        :return: a boolean indicating whether the user is allowed
        """

        def is_allowed_txn(
                txn: LoggingTransaction,
                user_id_txn: str,
                room_id_txn: str):
            txn.execute(
                """
                SELECT * FROM allowed_to_join_room WHERE user_id = ? AND room_id = ?
                """,
                (user_id_txn, room_id_txn),
            )
            row = txn.fetchone()
            return row is not None

        return await self.module_api.run_db_interaction(
            "allowed_to_join_room_select",
            is_allowed_txn,
            user_id,
            room_id
        )

    async def allow(self, user_id: str, room_id: str):
        """Allow a user to join a room

        :param user_id: the user
        :param room_id: the room
        """

        def allow_txn(
                txn: LoggingTransaction,
                user_id_txn: str,
                room_id_txn: str):
            txn.execute(
                """
                INSERT INTO allowed_to_join_room (user_id, room_id) VALUES (?, ?)
                """,
                (user_id_txn, room_id_txn),
            )

        await self.module_api.run_db_interaction(
            "allowed_to_join_room_insert",
            allow_txn,
            user_id,
            room_id
        )

    async def get_secured_rooms(self) -> Optional[list[SecuredRoom]]:
        """Get all secured rooms"""

        def get_secured_rooms_txn(txn: LoggingTransaction):
            txn.execute(
                """
                        SELECT sr.room_id, rss.name, accepted, user_txt, rss.room_type 
                        FROM secured_rooms AS sr 
                        INNER JOIN room_stats_state AS rss ON sr.room_id = rss.room_id AND rss.name NOT NULL
                        """)

            return txn.fetchall()

        rooms = await self.module_api.run_db_interaction(
            "get_secured_rooms",
            get_secured_rooms_txn
        )

        result = map(tuple_to_room, rooms)

        return result

    async def get_secured_room(self, id: str) -> Optional[SecuredRoom]:
        """Get a SecuredRoom by id."""

        def get_secured_room_txn(txn: LoggingTransaction, id_tx: str):
            txn.execute(
                """
                    SELECT sr.room_id, rss.name, accepted, user_txt, rss.room_type 
                    FROM secured_rooms AS sr 
                    INNER JOIN room_stats_state AS rss ON sr.room_id = rss.room_id AND rss.name NOT NULL
                    WHERE sr.room_id = ? 
                    """,
                [id_tx])

            return txn.fetchone()

        room = await self.module_api.run_db_interaction(
            "get_secured_room",
            get_secured_room_txn,
            id
        )
        if room:
            result = tuple_to_room(room)
            return result
        else:
            return None

    async def create_secured_room(self, room: SecuredRoom):
        """Turn database results into a SecuredRoom"""

        def create_secured_room_txn(txn: LoggingTransaction, room_tx: SecuredRoom):
            txn.execute(
                """
                    INSERT INTO secured_rooms(room_id, accepted, user_txt) VALUES (?, ?, ?)
                    """,
                (room_tx.room_id, json.dumps(room_tx.accepted, default=RoomAttributeEncoder().default), room_tx.user_txt)
            )

        await self.module_api.run_db_interaction(
            "create secured room",
            create_secured_room_txn,
            room
        )

    async def update_secured_room(self, room: SecuredRoom):
        """Update a SecuredRoom by id.
        """

        def update_secured_room_txn(
                txn: LoggingTransaction,
                room_tx: SecuredRoom):
            txn.execute(
                """
                UPDATE secured_rooms SET accepted = ?, user_txt = ? WHERE room_id = ?
                """,
                (json.dumps(room_tx.accepted, default=RoomAttributeEncoder().default), room_tx.user_txt,
                 room_tx.room_id)
            )

        await self.module_api.run_db_interaction(
            "update_secured_room",
            update_secured_room_txn,
            room,
        )

    async def delete_secured_room(self, room: SecuredRoom):
        """Delete a SecuredRoom. Match will happen on all room fields in secured_rooms table
        """

        def delete_secured_room_txn(
                txn: LoggingTransaction,
                room_tx: SecuredRoom):
            txn.execute(
                """
                DELETE FROM secured_rooms WHERE accepted = ? AND user_txt = ? AND room_id = ?
                """,
                (json.dumps(room_tx.accepted, default=RoomAttributeEncoder().default), room_tx.user_txt, room_tx.room_id)
            )

        await self.module_api.run_db_interaction(
            "delete_secured_room",
            delete_secured_room_txn,
            room,
        )


def tuple_to_room(room) -> SecuredRoom:
    (room_id, room_name, accepted, user_txt, type) = room
    return SecuredRoom(room_id=room_id, room_name=room_name, accepted=json.loads(accepted), user_txt=user_txt, type=type)
