import logging
from ._constants import METHOD_POLLING_INTERVAL
import time
from synapse.logging.context import run_in_background
from synapse.module_api import ModuleApi
from ._store import YiviRoomJoinStore
from ._store_modifier import StoreModifier, AddColumnsMigrationStrategy, RemoveColumnsMigrationStrategy, RenameColumnsMigrationStrategy

logger = logging.getLogger("synapse.contrib." + __name__)




class DBMigration(object):
    """Migration of Synapse database tables. This allows for modification of database tables.
    It's used as a synapse module. 
    
    Column information is passed as a tuple.
    
    Example usage: 
    To add a column to a table
    column_info =("expiration_time_days", "TEXT NOT NULL DEFAULT 0")
    
    To Remove a column from a table
    column_info = ("expiration_time_days",)
    
    To Rename a column.
    column_info = ("expiration_time_days","expiration")
        
    """
    

    def __init__(self, config: dict, api: ModuleApi, store=None):
        self._config = config

        if store:
            self.store = store
        else:
            self.store = YiviRoomJoinStore(api,config)
        self.module_api = api
        self.migration =  StoreModifier(api, RemoveColumnsMigrationStrategy())
        
        # Migration rules
        
        
        #column_info = ("expiration_time_days", "TEXT NOT NULL DEFAULT 90")
        column_info = ("expiration_time_days",)
        run_in_background(self.migration.modify, 'secured_rooms',  column_info) 
        
        # Migration related things
            
        # column_info_list =[
        #                 ("join_time", "TEXT NOT NULL DEFAULT " + str(time.time())),
        #                 ("user_expired", "INT NOT NULL DEFAULT 0"), 
        #                 ]

        # for column_info in column_info_list:
        #     run_in_background(self.migration.modify, 'allowed_to_join_room', column_info)
        
      


    @staticmethod
    def parse_config(config):
        return None