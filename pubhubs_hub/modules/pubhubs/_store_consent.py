from synapse.storage.database import LoggingTransaction
from synapse.module_api import ModuleApi
import logging

logger = logging.getLogger("synapse.contrib.hub_consent")

class ConsentStore:
    def __init__(self, module_api: ModuleApi):
        self.module_api = module_api
    
    async def get_user_consent_version(self, user_id):
        def get_user_consent_version_txn(txn: LoggingTransaction, user_id):
            txn.execute(
                """
                    SELECT consent_version FROM users WHERE name = ?;
                """,
                (user_id,) 
            )
            return txn.fetchone()
    
        return await self.module_api.run_db_interaction(
            "Getting user consent version",
            get_user_consent_version_txn,
            user_id
        )

    async def set_user_consent_version(self, accepted_consent_version, user_id):
        def set_user_consent_version_txn(txn: LoggingTransaction, accepted_consent_version, user_id):
            txn.execute(
                """
                    UPDATE users SET consent_version = ? WHERE name = ?;
                """,
                (accepted_consent_version, user_id)
            )
            return txn.rowcount 
    
        return await self.module_api.run_db_interaction(
            "Setting user consent version",
            set_user_consent_version_txn,
            accepted_consent_version,
            user_id
        )