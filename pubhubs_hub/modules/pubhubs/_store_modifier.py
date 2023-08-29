
from abc import ABC, abstractmethod
import logging
import re
from synapse.module_api import ModuleApi
from synapse.storage.database import LoggingTransaction
from .database_commands import database_commands

logger = logging.getLogger("synapse.contrib." + __name__)


# Utility function to get column names from the database 
async def check_column_exists(module_api, table_name: str, column_info: list) -> bool | Exception:
        """Check the correctness of number of columns. This is a check to make a decision for altering table.

        :param table_name: table name to check
        :param expected_column: Expected number of columns 
        :return: a boolean to decide whether a modified sql statement should be used or original one.
        """
        
        def check_columns_txn(txn: LoggingTransaction, table_name_txn: str, column_info_txn: str):
            # Check for database types
            db_engine = return_db_type(module_api)
            logger.debug(f"Checking database types {db_engine}")
            list_columns = database_commands[db_engine]['columns']
            for command in list_columns:
                txn.execute(command.format(table_name=table_name_txn),(),)
            
            row = txn.fetchall()
            if db_engine == 'sqlite3':
                db_columns = [element[1] for element in row]
            else:
                db_columns = [item for sublist in row for item in sublist]
            if len(column_info_txn) > 1:
                column_name, _ = column_info_txn  
                updated_columns = [column_name] 
            else:
                updated_columns =  list(column_info_txn)
            all_elements_present = all(element in db_columns for element in updated_columns)         
             
            logger.info(f"modification_state': {all_elements_present}, 'list_columns': {db_columns}")        
            return  {'modification_state': all_elements_present, 'list_columns': db_columns}
        
        return await module_api.run_db_interaction(
            "check_columns_txn",
            check_columns_txn,
            table_name,
            column_info
        )


def return_db_type(module_api) -> bool:
        # Looping could be useful for multiple database support.
        for data_config in module_api._hs.config.database.databases: 
                if data_config.config['name'] != None:    
                    return str(data_config.config['name']) 
                else:
                    raise NotImplementedError('Database support is not implemented. Refer to the documentation')
        
############################
# Input Validate methods
############################
# Prevent sql injection.
# Restricts the users to specific convention for defining column names.
# letters, numbers, dashes and underscores are allowed.
def check_column_name_validate(name:str)-> bool:
    if re.match("^[a-zA-Z0-9][ A-Za-z0-9-_]*$", name):
        return True
    else:
        return False

# Table should be present in the database.
# Creation of tables are done separately.
def check_table_name_validate(txn,module_api, name:str)-> bool:
    
    db_engine = return_db_type(module_api)
    list_tables = database_commands[db_engine]['tables']
   
    for command in list_tables:
        txn.execute(command)
    
    row = txn.fetchall()
    table_exists = [item for item in row if name in item]
    if len(table_exists) > 0:
        return True
    else:
        return False


# Strategy design pattern: https://refactoring.guru/design-patterns/strategy
class MigrationStrategy(ABC):
    
    @abstractmethod
    async def check_column(self, table_name, column_info):
        pass
    
    @abstractmethod
    async def modify(self, table_name, expected_column, column_info, opt_db_columns):
        pass
        

# Concrete class for each type of Store modification strategy, 
# We can make different strategies for REMOVE, UPDATE store.
class AddColumnsMigrationStrategy(MigrationStrategy):
       
    async def check_column(self, module_api, table_name: str, column_info: list) -> bool:
        modification_info =  await check_column_exists(module_api, table_name, column_info)
        modification_info['modification_state'] = not modification_info['modification_state']
        return modification_info
    
    async def modify(self, module_api, table_name, columns_to_add, db_columns):
        
        
        def add_column_migration(txn: LoggingTransaction):
            
            if not check_table_name_validate(txn,module_api,table_name):
                raise ValueError("Given table name is not a valid table name")
            
            db_engine = return_db_type(module_api)
            alter_command = database_commands[db_engine]['add']

            column_name, column_definition = columns_to_add
            if not check_column_name_validate(column_name):
                    raise ValueError("Given column name is not a valid column name. Use letters, numbers, dashes or underscore")
            for command in alter_command:
                    txn.execute(command.format(table_name=table_name, column_name=column_name, column_definition=column_definition))
                        
                    

        await module_api.run_db_interaction(
            "add column migration",
            add_column_migration,
        )

class RemoveColumnsMigrationStrategy(MigrationStrategy):
    
    async def check_column(self, module_api, table_name: str, column_info: list) -> bool:
        modification_info =  await check_column_exists(module_api, table_name, column_info)
        return modification_info
    
    async def modify(self, module_api, table_name, rm_column, db_columns):
        
        column_to_remove = rm_column[0]
        
        def remove_column_migration(txn: LoggingTransaction):
            
                if not check_table_name_validate(txn,module_api,table_name):
                    raise ValueError("Given table name is not a valid table name")
            
                db_engine = return_db_type(module_api)
                alter_commands = database_commands[db_engine]['remove']
                if not check_column_name_validate(column_to_remove):
                    raise ValueError("Given column name is not a valid column name. Use letters, numbers, dashes or underscore")
                
                # Very specific case for sqlite3. A heavy operation.
                # other db should not have this problem
                if db_engine  == 'sqlite3':
                    if column_to_remove in db_columns:
                        db_columns.remove(column_to_remove)
                    column=', '.join(db_columns)  
                else:
                    column = column_to_remove

                # Format and execute each command
                for command in alter_commands:
                    
                    sql_command = command.format(table_name=table_name, column_name=column)
                    
                    txn.execute(sql_command)

        await module_api.run_db_interaction(
            "remove column migration",
            remove_column_migration,
        )


class RenameColumnsMigrationStrategy(MigrationStrategy):
       
    async def check_column(self, module_api, table_name: str, column_info: list) -> bool:
        modification_info =  await check_column_exists(module_api, table_name, column_info)
        return modification_info
    
    async def modify(self, module_api, table_name, columns_to_rename, db_columns):
                 
        def rename_column_migration(txn: LoggingTransaction):
            
            if not check_table_name_validate(txn,module_api,table_name):
                raise ValueError("Given table name is not a valid table name")
            
            db_engine = return_db_type(module_api)
            alter_command = database_commands[db_engine]['rename']
            old_column, new_column = columns_to_rename
            if not check_column_name_validate(new_column) and check_column_name_validate(old_column) :
                    raise ValueError("Given column name is not a valid column name. Use letters, numbers, dashes or underscore")
            for command in alter_command:
                        txn.execute(
                            command.format(table_name=table_name, old_column=old_column, new_column=new_column),
                            ()
                        )

        await module_api.run_db_interaction(
            "rename column migration",
            rename_column_migration,
        )



class StoreModifier(object):
    """Contains methods for modifying the store."""

    def __init__(self, module_api: ModuleApi, modification_strategy: MigrationStrategy):
        self.module_api = module_api
        self.modification_strategy = modification_strategy

    async def modify(self, table_name,  column_info):
        
        if not isinstance(column_info, tuple):
            raise TypeError("column_info must be a tuple")
        
        if not len(column_info[0]) > 1:
            # main the format of tuple e.g., ("element",) and not ("element")
            raise TypeError("column_info must contain a comma e.g., (\"column_name,\")")
         
        modification_info = await self.modification_strategy.check_column(self.module_api,table_name, column_info)
        if modification_info['modification_state']:
            await self.modification_strategy.modify(self.module_api, table_name, column_info, modification_info['list_columns'])

