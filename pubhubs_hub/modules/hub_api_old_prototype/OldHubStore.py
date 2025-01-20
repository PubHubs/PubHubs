from synapse.module_api import ModuleApi
from synapse.storage.database import LoggingTransaction
import logging

logger = logging.getLogger(__name__)

class HubStore:
  """Contains methods for database operations.
  """

  def __init__(self, module_api: ModuleApi):
    logger.info("Initializing HubStore...")
    self.module_api = module_api


  async def create_tables(self):
    await self.module_api.run_db_interaction("Creating hub table (if it does not exist)...", HubStore.create_tables_txn)


  async def init_hub_info(self):
    hub_data_exists = await self.module_api.run_db_interaction("Check if hub info is initialized", HubStore.hub_data_exists_txn)
    if hub_data_exists:
      logger.info("Hub info already exists, skipping initialization")
      return

    await self.module_api.run_db_interaction("Initializing hub info...", HubStore.init_data_txn)

  async def get_hub_info(self) -> tuple | None:
    return await self.module_api.run_db_interaction("Getting hub info...", HubStore.get_hub_txn)

#region database transactions
  def create_tables_txn(txn: LoggingTransaction):
    txn.execute(
      """
      CREATE TABLE IF NOT EXISTS hub (
        name VARCHAR(60) DEFAULT(''),
        active BIT DEFAULT(0)
      );
      """
    )

  def hub_data_exists_txn(txn: LoggingTransaction) -> bool:
      txn.execute("SELECT * FROM hub")
      return bool(txn.fetchall())

  def init_data_txn(txn: LoggingTransaction):
    txn.execute(
      """
      INSERT INTO hub (name, active) VALUES ('', 0);
      """
    )

  def get_hub_txn(txn: LoggingTransaction) -> tuple | None:
    txn.execute("SELECT name, active FROM hub")
    return txn.fetchone()

#endregion
