import json
import logging
import secrets
import string
import time
from datetime import datetime
from typing import Optional
from synapse.module_api import ModuleApi
from synapse.storage.database import LoggingTransaction
from synapse.storage.engines import PostgresEngine, Sqlite3Engine
from ._secured_rooms_class import SecuredRoom, RoomAttributeEncoder

logger = logging.getLogger(__name__)

TOKEN_DURATION = 24 * 60 * 60


def _generate_token() -> (str, int):
    now = int(time.time())
    token = f"{now}".join(secrets.choice(string.ascii_letters)
                          for _ in range(22))
    token_expiration = now + TOKEN_DURATION
    return token, token_expiration



class HubStore:
    """Contains methods for database operations connected to room access with Yivi.
    """

    def __init__(self, module_api: ModuleApi, config: dict):
        self._config = config
        self._module_api = module_api


    async def create_tables(self) -> None:
        """Creates the necessary tables for allowing users access using Yivi.
        """

        def create_tables_txn(txn: LoggingTransaction) -> None:
            # No functionality yet for expired Yivi attributes, now able to join room forever.
            # Make some background check for it see: https://github.com/matrix-org/synapse-email-account-validity for an example.
            # WARNING!  When adding a new table, make sure you consider modifying the
            #           sqlite3 -> postgres migration code in start_hub.py.
            
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
            
            txn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS joined_hub(
                        user_id TEXT NOT NULL
                    )
                    """,
                    (),
                )

            txn.execute(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS joined_hub_idx
                    ON joined_hub(user_id)
                """,
                (),
            )

        await self._module_api.run_db_interaction(
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
                room_id_txn: str) -> bool:
            txn.execute(
                """
                SELECT * FROM allowed_to_join_room WHERE user_id = ? AND room_id = ?
                """,
                (user_id_txn, room_id_txn),
            )
            row = txn.fetchone()
            return row is not None

        return await self._module_api.run_db_interaction(
            "allowed_to_join_room_select",
            is_allowed_txn,
            user_id,
            room_id
        )

    async def allow(self, user_id: str, room_id: str, join_time: datetime) -> None:
        """Allow a user to join a room

        :param user_id: the user
        :param room_id: the room
        :param join_time: the room has been joined by the user with expiration time.
        """


        def allow_txn(
                txn: LoggingTransaction,
                user_id_txn: str,
                room_id_txn: str,
                join_time_txn: str) -> None:
             # Check if the user is already allowed to join the room
            txn.execute(
                """
                SELECT 1 FROM allowed_to_join_room WHERE user_id = ? AND room_id = ?
                """,
                (user_id_txn, room_id_txn),
            )
            row = txn.fetchone()

            if row:
                # User is already allowed, update the join_time
                txn.execute(
                    """
                    UPDATE allowed_to_join_room
                    SET join_time = ?, user_expired = 0
                    WHERE user_id = ? AND room_id = ?
                    """,
                    (join_time_txn, user_id_txn, room_id_txn),
                )
                logger.info(f"allowed_to_join_room: renewed access for user {user_id_txn} in room {room_id_txn}")
            else:
                # Insert a new record if the user is not already allowed
                txn.execute(
                    """
                    INSERT INTO allowed_to_join_room (user_id, room_id, join_time)
                    VALUES (?, ?, ?)
                    """,
                    (user_id_txn, room_id_txn, join_time_txn),
                )
                logger.info(f"allowed_to_join_room: granted access for user {user_id_txn} in room {room_id_txn}")


        await self._module_api.run_db_interaction(
            "allowed_to_join_room_insert",
            allow_txn,
            user_id,
            room_id,
            join_time
        )


    async def remove_from_room(self) -> None:
        def set_expiry_from_user_txn(
                txn: LoggingTransaction,
                ) -> Optional[list[tuple]]:

            # c.f. https://github.com/element-hq/synapse/blob/04206aebdf2444f189a5744b5cb62d419ff83e8b/synapse/storage/databases/main/search.py#L86
            if isinstance(txn.database_engine, PostgresEngine):
                # https://www.postgresql.org/docs/current/functions-datetime.html
                unix_now = "EXTRACT(EPOCH FROM NOW())"
                cast_col = "CAST(join_time AS DOUBLE PRECISION)"
            elif isinstance(txn.database_engine, Sqlite3Engine):
                unix_now = "CAST(strftime('%s', 'now') AS REAL)"
                cast_col = "CAST(join_time AS REAL)"
            else:
                raise NotImplementedError(f"Unsupported database engine: {type(txn.database_engine)}")

            # NOTE: the CAST(expiration_time_days as INTEGER) is needed because (for some reason)
            #       expiration_time_days has type TEXT.
            txn.execute(
                f"""
                UPDATE allowed_to_join_room SET user_expired = 1
                WHERE {cast_col} <= {unix_now} - (
                    SELECT CAST(expiration_time_days AS INTEGER) * 24 * 60 * 60
                    FROM secured_rooms
                    WHERE room_id = allowed_to_join_room.room_id
                )
                """,
            )

            txn.execute(
                """
                SELECT user_id,room_id from allowed_to_join_room WHERE user_expired = 1
                """,
            )
            return txn.fetchall()

        result = await self._module_api.run_db_interaction(
            "set_expiry_from_user_txn",
            set_expiry_from_user_txn,

        )

        for row in result:
            user_id, room_id =  row
            try:
                logger.info(f"allowed_to_join_room: removing expired user {user_id} from room {room_id}")
                await self._module_api.update_room_membership(user_id, user_id, room_id, "leave")
            except Exception as e:
                logger.error(f"Could not remove user with id {user_id} from room {room_id} after the user was expired, Error: {e}")
           



    async def get_room_expiration_time_days(self, room_id=None) -> Optional[int]:

        def get_room_expiration_time_days_txn(txn: LoggingTransaction, room_id_txn) -> Optional[int]:

            txn.execute(
                    """
                    SELECT expiration_time_days FROM secured_rooms WHERE room_id = ?
                    """,
                    (room_id_txn,),
                )
            return txn.fetchone()


        return await self._module_api.run_db_interaction(
            "get_room_expiration_time_days",
            get_room_expiration_time_days_txn,
            room_id,
        )

    async def get_secured_rooms(self) -> Optional[list[SecuredRoom]]:
        """Get all secured rooms"""

        def get_secured_rooms_txn(txn: LoggingTransaction):
            txn.execute(
                        """
                        SELECT sr.room_id, rss.name, rss.topic, accepted, expiration_time_days, user_txt, rss.room_type
                        FROM secured_rooms AS sr
                        INNER JOIN room_stats_state AS rss ON sr.room_id = rss.room_id AND rss.name IS NOT NULL
                        """)

            return txn.fetchall()

        rooms = await self._module_api.run_db_interaction(
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
                    SELECT sr.room_id, rss.name, rss.topic, accepted,expiration_time_days,user_txt, rss.room_type
                    FROM secured_rooms AS sr
                    INNER JOIN room_stats_state AS rss ON sr.room_id = rss.room_id AND rss.name IS NOT NULL
                    WHERE sr.room_id = ?
                    """,
                [id_tx])

            return txn.fetchone()

        room = await self._module_api.run_db_interaction(
            "get_secured_room",
            get_secured_room_txn,
            id
        )
        if room:
            result = tuple_to_room(room)
            return result
        else:
            return None

    async def create_secured_room(self, room: SecuredRoom) -> None:
        """Turn database results into a SecuredRoom"""

        def create_secured_room_txn(txn: LoggingTransaction, room_tx: SecuredRoom) -> None:
                    txn.execute(
                        """
                            INSERT INTO secured_rooms(room_id, accepted, user_txt, expiration_time_days) VALUES (?, ?, ?, ?)
                            """,
                        (room_tx.room_id, json.dumps(room_tx.accepted, default=RoomAttributeEncoder().default), room_tx.user_txt,room_tx.expiration_time_days )
                    )

        await self._module_api.run_db_interaction(
            "create secured room",
            create_secured_room_txn,
            room
        )


    async def update_secured_room(self, room: SecuredRoom) -> None:
        """Update a SecuredRoom by id.
        """

        def update_secured_room_txn(
                txn: LoggingTransaction,
                room_tx: SecuredRoom) -> None:
            txn.execute(
                """
                UPDATE secured_rooms SET accepted = ?, expiration_time_days = ?, user_txt = ? WHERE room_id = ?
                """,
                (json.dumps(room_tx.accepted, default=RoomAttributeEncoder().default), room_tx.expiration_time_days, room_tx.user_txt,
                 room_tx.room_id)
            )

        await self._module_api.run_db_interaction(
            "update_secured_room",
            update_secured_room_txn,
            room,
        )

    async def delete_secured_room(self, room: SecuredRoom) -> None:
        """Delete a SecuredRoom. Match will happen on all room fields in secured_rooms table
        """

        def delete_secured_room_txn(
                txn: LoggingTransaction,
                room_tx: SecuredRoom) -> None:
            txn.execute(
                """
                DELETE FROM secured_rooms WHERE accepted = ? AND expiration_time_days = ? AND user_txt = ? AND room_id = ?
                """,
                (json.dumps(room_tx.accepted, default=RoomAttributeEncoder().default), room_tx.expiration_time_days  ,room_tx.user_txt, room_tx.room_id)
            )

        await self._module_api.run_db_interaction(
            "delete_secured_room",
            delete_secured_room_txn,
            room,
        )


    async def all_rooms_latest_timestamp(self) -> Optional[list[tuple]]:
            """
            Returns the latest activity timestamp for every room.
            """
            
            
            def all_rooms_latest_timestamp_txn(
                txn: LoggingTransaction) -> Optional[list[tuple]]:

                txn.execute(
                        """
                            SELECT e.received_ts, s.room_id
                            FROM sliding_sync_joined_rooms s
                            JOIN events e ON e.stream_ordering = s.event_stream_ordering
                            JOIN rooms r ON r.room_id = s.room_id
                            WHERE r.is_public

                            """,
                    )
                return txn.fetchall()
            
            return await self._module_api.run_db_interaction(
                    "retrieve_room_timestamps",
                    all_rooms_latest_timestamp_txn
        ) 
    async def user_join_time(self, user_id:str) -> Optional[list[tuple]]:
            """
            Returns when the user joined for every secured room.
            """
            
            
            def user_join_time_txn(
                txn: LoggingTransaction,
                user_id_txn: str) -> Optional[list[tuple]]:

                txn.execute(
                    """
                    SELECT room_id, join_time, user_expired FROM allowed_to_join_room WHERE user_id = ?
                    """,
                    (user_id_txn,),
                )
                return txn.fetchall()
            
            return await self._module_api.run_db_interaction(
                    "user_join_time",
                    user_join_time_txn,
                    user_id,
        )
    
    async def remove_users_from_secured_room(self, room_id: str) -> None:
        """Remove all users from a secured room.

        :param room_id: The room to remove users from.
        """

        def remove_users_from_secured_room_txn(
                txn: LoggingTransaction,
                room_id_txn: str) -> None:
            txn.execute(
                """
                UPDATE allowed_to_join_room SET user_expired = 1 WHERE room_id = ?
                """,
                (room_id_txn,),
            )

        logger.info(f"allowed_to_join_room: removing all users from room {room_id}")
        await self._module_api.run_db_interaction(
            "remove_users_from_secured_room",
            remove_users_from_secured_room_txn,
            room_id,
        )
        await self.remove_from_room()
    async def remove_allowed_join_room_row(self, room_id: str, user_id:str) -> None:
        """Remove a user from the allowed_to_join_room table.

        :param room_id: The room id of the notification that has been dismissed.
        :param user_id: The user that dismissed the expired secured room notification.
        The row will be removed from the allowed_to_join_room table
        so that the expired secured roomnotification will not be shown again.
        """

        def remove_allowed_join_room_row_txn(
                txn: LoggingTransaction,
                room_id_txn: str,
                user_id_txn: str) -> None:
            txn.execute(
                """
                DELETE FROM allowed_to_join_room WHERE room_id = ? AND user_id = ?
                """,
                (room_id_txn, user_id_txn),
            )

        await self._module_api.run_db_interaction(
            "remove_allowed_join_room_row",
            remove_allowed_join_room_row_txn,
            room_id,
            user_id
        )

    async def has_joined(self, user_id: str) -> bool:
            """Check whether a user is allowed to join a room.

            :param user_id: The user that wants to join the room
            :param room_id: The room the user wants to join
            :return: a boolean indicating whether the user is allowed
            """

            def has_joined_txn(
                    txn: LoggingTransaction,
                    user_id_txn: str):
                txn.execute(
                    """
                    SELECT * FROM joined_hub WHERE user_id = ?
                    """,
                    (user_id_txn,),
                )
                row = txn.fetchone()
                return row is not None

            return await self._module_api.run_db_interaction(
                "has_join_hub_select",
                has_joined_txn,
                user_id,
            )

    async def get_hub_admins(self) -> list:
        """Get all hub admin user Ids"""

        def get_hub_admins_txn(txn: LoggingTransaction):
            txn.execute(
                        """
                        SELECT * FROM users WHERE admin = 1;
                        """)
            
            return txn.fetchall()

        return await self._module_api.run_db_interaction(
            "get_hub_admins",
            get_hub_admins_txn
        )
    
    async def get_user_consent_version(self, user_id) -> Optional[int]:
        def get_user_consent_version_txn(txn: LoggingTransaction, user_id) -> Optional[int]:
            txn.execute(
                """
                    SELECT consent_version FROM users WHERE name = ?;
                """,
                (user_id,) 
            )
            return txn.fetchone()
    
        return await self._module_api.run_db_interaction(
            "Getting user consent version",
            get_user_consent_version_txn,
            user_id
        )

    async def set_user_consent_version(self, accepted_consent_version, user_id) -> None:
        def set_user_consent_version_txn(txn: LoggingTransaction, accepted_consent_version, user_id) -> None:
            txn.execute(
                """
                    UPDATE users SET consent_version = ? WHERE name = ?;
                """,
                (accepted_consent_version, user_id)
            )
    
        await self._module_api.run_db_interaction(
            "Setting user consent version",
            set_user_consent_version_txn,
            accepted_consent_version,
            user_id
        )
        
    async def get_event_reports_for_room(
        self,
        room_id: str,
        start: int = 0,
        limit: int = 100,
        backwards: bool = True,
    ) -> tuple[list[dict], int]:
        """Get paginated event reports for a specific room.

        Args:
            room_id: The room to get reports for
            start: Pagination offset
            limit: Maximum number of results
            backwards: If True, return newest first; if False, oldest first

        Returns:
            Tuple of (list of report dicts, total count)
        """
        return await self.get_event_reports_for_rooms([room_id], start, limit, backwards)

    async def get_event_reports_for_rooms(
        self,
        room_ids: list[str],
        start: int = 0,
        limit: int = 100,
        backwards: bool = True,
    ) -> tuple[list[dict], int]:
        """Get paginated event reports for multiple rooms.

        Args:
            room_ids: List of room IDs to get reports for
            start: Pagination offset
            limit: Maximum number of results
            backwards: If True, return newest first; if False, oldest first

        Returns:
            Tuple of (list of report dicts, total count)
        """
        if not room_ids:
            return [], 0

        def get_event_reports_for_rooms_txn(
            txn: LoggingTransaction,
            room_ids_txn: list[str],
            start_txn: int,
            limit_txn: int,
            backwards_txn: bool,
        ) -> tuple[list[dict], int]:
            order = "DESC" if backwards_txn else "ASC"
            placeholders = ",".join("?" * len(room_ids_txn))

            # Get total count
            txn.execute(
                f"""
                SELECT COUNT(*) FROM event_reports
                WHERE room_id IN ({placeholders})
                """,
                room_ids_txn,
            )
            total = txn.fetchone()[0]

            # Get paginated results
            txn.execute(
                f"""
                SELECT
                    er.id,
                    er.received_ts,
                    er.room_id,
                    er.event_id,
                    er.user_id,
                    er.content,
                    events.sender,
                    room_stats_state.canonical_alias,
                    room_stats_state.name
                FROM event_reports AS er
                LEFT JOIN events ON events.event_id = er.event_id
                LEFT JOIN room_stats_state ON room_stats_state.room_id = er.room_id
                WHERE er.room_id IN ({placeholders})
                ORDER BY er.received_ts {order}
                LIMIT ?
                OFFSET ?
                """,
                (*room_ids_txn, limit_txn, start_txn),
            )

            reports = []
            for row in txn:
                try:
                    content = json.loads(row[5]) if row[5] else {}
                    score = content.get("score")
                    reason = content.get("reason")
                except Exception:
                    logger.error(f"Unable to parse json from event_reports: {row[0]}")
                    continue

                reports.append(
                    {
                        "id": row[0],
                        "received_ts": row[1],
                        "room_id": row[2],
                        "event_id": row[3],
                        "user_id": row[4],
                        "score": score,
                        "reason": reason,
                        "sender": row[6],
                        "canonical_alias": row[7],
                        "name": row[8],
                    }
                )

            return reports, total

        return await self._module_api.run_db_interaction(
            "get_event_reports_for_rooms",
            get_event_reports_for_rooms_txn,
            room_ids,
            start,
            limit,
            backwards,
        )

    async def get_event_report(self, report_id: int) -> Optional[dict]:
        """Get a single event report by ID.

        Args:
            report_id: The ID of the report

        Returns:
            Report dict or None if not found
        """

        def get_event_report_txn(
            txn: LoggingTransaction,
            report_id_txn: int,
        ) -> Optional[dict]:
            txn.execute(
                """
                SELECT
                    er.id,
                    er.received_ts,
                    er.room_id,
                    er.event_id,
                    er.user_id,
                    er.content,
                    events.sender,
                    room_stats_state.canonical_alias,
                    room_stats_state.name,
                    event_json.json AS event_json
                FROM event_reports AS er
                LEFT JOIN events ON events.event_id = er.event_id
                LEFT JOIN event_json ON event_json.event_id = er.event_id
                LEFT JOIN room_stats_state ON room_stats_state.room_id = er.room_id
                WHERE er.id = ?
                """,
                (report_id_txn,),
            )

            row = txn.fetchone()
            if not row:
                return None

            try:
                content = json.loads(row[5]) if row[5] else {}
                event_json_data = json.loads(row[9]) if row[9] else None
            except Exception:
                logger.error(f"Unable to parse json from event_reports: {row[0]}")
                content = {}
                event_json_data = None

            return {
                "id": row[0],
                "received_ts": row[1],
                "room_id": row[2],
                "event_id": row[3],
                "user_id": row[4],
                "score": content.get("score"),
                "reason": content.get("reason"),
                "sender": row[6],
                "canonical_alias": row[7],
                "name": row[8],
                "event_json": event_json_data,
            }

        return await self._module_api.run_db_interaction(
            "get_event_report",
            get_event_report_txn,
            report_id,
        )

    async def delete_event_report(self, report_id: int) -> bool:
        """Delete an event report by ID.

        Args:
            report_id: The ID of the report to delete

        Returns:
            True if deleted, False if not found
        """

        def delete_event_report_txn(
            txn: LoggingTransaction,
            report_id_txn: int,
        ) -> bool:
            txn.execute(
                """
                DELETE FROM event_reports WHERE id = ?
                """,
                (report_id_txn,),
            )
            return txn.rowcount > 0

        return await self._module_api.run_db_interaction(
            "delete_event_report",
            delete_event_report_txn,
            report_id,
        )

    async def get_rooms_with_power_level(
        self,
        user_id: str,
        min_power_level: int,
    ) -> list[str]:
        """Get all rooms where a user has at least the specified power level.

        Args:
            user_id: The user ID to check
            min_power_level: The minimum power level required

        Returns:
            List of room IDs where the user has the required power level
        """

        def get_rooms_with_power_level_txn(
            txn: LoggingTransaction,
            user_id_txn: str,
            min_power_level_txn: int,
        ) -> list[str]:
            # Get all rooms the user is a member of along with power levels JSON
            txn.execute(
                """
                SELECT rm.room_id, ej.json
                FROM room_memberships rm
                INNER JOIN current_state_events cse
                    ON cse.room_id = rm.room_id
                    AND cse.type = 'm.room.power_levels'
                    AND cse.state_key = ''
                INNER JOIN event_json ej
                    ON ej.event_id = cse.event_id
                WHERE rm.user_id = ?
                AND rm.membership = 'join'
                """,
                (user_id_txn,),
            )

            rooms_with_power = []
            for room_id, power_levels_json in txn.fetchall():
                try:
                    event_json = json.loads(power_levels_json)
                    content = event_json.get("content", {})
                    users = content.get("users", {})
                    user_power = users.get(user_id_txn, content.get("users_default", 0))
                    if user_power >= min_power_level_txn:
                        rooms_with_power.append(room_id)
                except (json.JSONDecodeError, KeyError):
                    continue

            return rooms_with_power

        return await self._module_api.run_db_interaction(
            "get_rooms_with_power_level",
            get_rooms_with_power_level_txn,
            user_id,
            min_power_level,
        )


def tuple_to_room(room) -> SecuredRoom:
    logger.info(f"Tuple looks like  {room}")
    (room_id, name, topic, accepted, expiration_time_days, user_txt, type) = room
    if topic is None:
        topic = ''
    return SecuredRoom(room_id=room_id, name=name, topic=topic, accepted=json.loads(accepted), expiration_time_days=expiration_time_days, user_txt=user_txt, type=type)

