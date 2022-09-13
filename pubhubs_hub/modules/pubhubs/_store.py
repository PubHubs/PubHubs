import logging
import secrets
import string
import time
from typing import Optional, Tuple

from synapse.module_api import ModuleApi
from synapse.storage.database import LoggingTransaction

logger = logging.getLogger(__name__)

TOKEN_DURATION = 24 * 60 * 60


def _generate_token() -> (str, int):
    now = int(time.time())
    token = f"{now}".join(secrets.choice(string.ascii_letters)
                          for _ in range(22))
    token_expiration = now + TOKEN_DURATION
    return token, token_expiration


class IrmaRoomJoinStore:
    """Contains methods for database operations connected to room access with IRMA.
    """

    def __init__(self, module_api: ModuleApi):
        self.module_api = module_api

    async def create_tables(self):
        """Creates the necessary tables for allowing users access using IRMA.
        """

        def create_tables_txn(txn: LoggingTransaction):
            # No functionality yet for expired IRMA attributes, now able to join room forever.
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
                CREATE TABLE IF NOT EXISTS wants_to_join_room(
                    user_id TEXT NOT NULL,
                    room_id TEXT NOT NULL,
                    waiting_room_id NOT NULL,
                    token TEXT NOT NULL,
                    token_expiration BIGINT NOT NULL
                )
                """,
                (),
            )

            txn.execute(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS wants_user_room_idx
                    ON wants_to_join_room(user_id, room_id, waiting_room_id)
                """,
                (),
            )

            txn.execute(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS wants_user_room_token_idx
                    ON wants_to_join_room(token)
                """,
                (),
            )

        await self.module_api.run_db_interaction(
            "allowed_and_wants_to_join_room_create_tables",
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

    async def wants_to_join(self, user_id: str, room_id: str, waiting_room_id: str) -> str:
        """Register the waiting room for a room and user

        :param user_id: the user
        :param room_id: the room to join
        :param waiting_room_id: the waiting room

        :return: the token to use to register, the token will expire after  a while
        """

        def wants_txn(
                txn: LoggingTransaction,
                user_id_txn: str,
                room_id_txn: str,
                waiting_room_id_txn: str,
                token_txn: str,
                token_expiration_txn: int):
            txn.execute(
                """
                INSERT INTO wants_to_join_room(user_id, room_id, waiting_room_id,token,token_expiration) VALUES (?, ?, ?
                , ?, ?)
                """,
                (user_id_txn, room_id_txn, waiting_room_id_txn,
                 token_txn, token_expiration_txn),
            )

        (token, token_expiration) = _generate_token()
        await self.module_api.run_db_interaction(
            "insert_wants_txn",
            wants_txn,
            user_id,
            room_id,
            waiting_room_id,
            token,
            token_expiration
        )

        return token

    async def user_and_waiting_from_token(self, token) -> Optional[Tuple[str, str]]:
        """Get the corresponding user and waiting room id for a token, that is not expired.

        :param token: the token
        :return: a tuple containing the user id and waiting room id or None if there is no corresponding user
        and waiting room or the token is expired.
        """

        def user_from_token_txn(
                txn: LoggingTransaction,
                token_txn: str,
                current_time: int):
            txn.execute(
                """
               SELECT user_id, waiting_room_id FROM wants_to_join_room WHERE token = ? AND token_expiration  > ?
               """,
                (token_txn, current_time),
            )
            selected = txn.fetchone()
            return selected

        return await self.module_api.run_db_interaction(
            "select_user_from_join_irma_token",
            user_from_token_txn,
            token,
            int(time.time())
        )

    async def refresh_token(self, old_token: str) -> str:
        """Refresh an expired token. Old token cannot be used anymore and the new token will need to be communicated
        to the user.

        :param old_token: the token to refresh
        :return: the newly refreshed token for the user and waiting room
        """

        def refresh_token_txn(
                txn: LoggingTransaction,
                new_token: str,
                token_expiration_txn: int,
                old_token_txn: str):
            txn.execute(
                """
                UPDATE wants_to_join_room SET token = ?, token_expiration = ? WHERE token = ?
                """,
                (new_token, token_expiration_txn, old_token_txn)
            )

        (token, token_expiration) = _generate_token()

        await self.module_api.run_db_interaction(
            "refresh_join_irma_token",
            refresh_token_txn,
            token,
            token_expiration,
            old_token,
        )

        return token

    async def valid_waiting_room(self, user_id: str, room_id: str) -> Optional[Tuple[str, str]]:
        """Find a valid waiting room for a user and room.

        :param user_id: the user id
        :param room_id: the room that possibly has a waiting room for the supplied user
        :return: a tuple consisting of the waiting room id and the corresponding token or none if no waiting room exists
        with a non-expired token
        """

        def select_txn(
                txn: LoggingTransaction,
                user_id_txn: str,
                room_id_txn: str,
                token_expiration: int):
            txn.execute(
                """
               SELECT waiting_room_id, token FROM wants_to_join_room WHERE user_id = ? AND room_id = ? AND
               token_expiration  > ?
               """,
                (user_id_txn, room_id_txn, token_expiration),
            )
            selected = txn.fetchone()

            return selected

        return await self.module_api.run_db_interaction(
            "select_waiting_room",
            select_txn,
            user_id,
            room_id,
            int(time.time())
        )

    async def expired_token_waiting_room(self, user_id: str, room_id: str) -> Optional[str]:
        """Find a waiting room for a user and room with an expired token.

        :param user_id: the user id
        :param room_id: the room that has a waiting room with an expired token for the supplied user
        :return: a tuple consisting of the waiting room id and the corresponding token or none if no waiting room exists
        with an expired token
        """
        def select_expired_txn(
                txn: LoggingTransaction,
                user_id_txn: str,
                room_id_txn: str,
                current_time: int):
            txn.execute(
                """
               SELECT waiting_room_id, token FROM wants_to_join_room WHERE user_id = ? AND room_id = ? AND
               token_expiration  <= ?
               """,
                (user_id_txn, room_id_txn, current_time),
            )
            selected = txn.fetchone()

            return selected

        return await self.module_api.run_db_interaction(
            "select_expired_waiting_room",
            select_expired_txn,
            user_id,
            room_id,
            int(time.time())
        )

    async def get_room_name(self, room_id: str) -> Optional[str]:
        """ Get the name of a room.

        :param room_id: the room id
        :return: the name of the room or None of no such room exists
        """
        def get_room_name_txn(
                txn: LoggingTransaction,
                room_id_txn: str) -> None:
            txn.execute(
                """
                    SELECT name FROM room_stats_state WHERE room_id = ?
                    """,
                [room_id_txn],
            )

            result = txn.fetchone()
            if result:
                return result[0]
            else:
                return None

        return await self.module_api.run_db_interaction(
            "get_room_name",
            get_room_name_txn,
            room_id
        )
