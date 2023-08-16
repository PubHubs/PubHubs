# Synapse database update

### Guide for updating database in synapse.

- There is provision for updating tables in the synapse database.
- PubHubs provide support for adding columns, removing columns and renaming columns in existing tables in sqlite3 and postgresql databases.
- This can be demonstrated in the following file. Path of the file is `/pubhubs_hubs/modules/database_commands.py`.

New commands for altering tables can also be added. This will also require adding a class in `/pubhubs_hubs/modules/_store_modifier.py`. For example, modify method contains the logic for specific type of migration operation.

```python
class AddColumnsMigrationStrategy(MigrationnStrategy):

    # The functionality of migration is implemented here.   
    async def modify(self, module_api, table_name, columns_to_add, db_columns):
        pass
        
     
```
The module `DBMigration`  in `/pubhubs_hubs/modules/pubhubs/DBMigration.py` calls the migration strategy.
For example, the code below shows the migration strategy for Add columns migration, but this needs to be
updated based on the migration strategy to be used.

```python
x = StoreModifier(module_api, AddColumnsModificationStrategy())

# Column(s) to add this is defined as a list of tuple.
column_info =[("expiration_time_days", "TEXT NOT NULL DEFAULT 0")]

# call to modify method with table name and the list of tuple.
x.modify('secured_rooms',  column_info)

```


