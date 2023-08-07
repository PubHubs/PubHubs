# Dictionary containing alter commands for different database types and modifications.
# Update the database engine commands here

# Notes:
# columns, add, remove keys are sqlite commands for modifying tables.
# -- If a specific database has a specific feature, key - value pair can be added for that database and key with empty string can be added for other database.
# -- New database requires a new dictionary. e.g., assume there is support for mysql then copy the key with values of sqlite3 and update the operation commands 
#


database_commands = {
    'sqlite3': {
        # Lists all tables in the database.
        'tables': ['SELECT name FROM sqlite_schema where type = \'table\''],
        # Lists all columns in a given table.
        'columns': ['PRAGMA table_info({table_name})'],
        # Add a new column with the given name, and its definition in a given table.
        'add': ['ALTER TABLE {table_name} ADD COLUMN {column_name} {column_definition}'],
         # Removes the column.
         "remove": [
            "CREATE TABLE new_{table_name} AS SELECT {column_name} FROM {table_name};",
            "DROP TABLE {table_name};",
            "ALTER TABLE new_{table_name} RENAME TO {table_name};"
        ],
        # Renames the column name.
        'rename': ['ALTER TABLE {table_name} RENAME COLUMN {old_column} TO {new_column}'],

    },
    'psycopg2': {  
        # Lists all tables in the database.
        'tables': ['SELECT table_name FROM information_schema.tables'],
        # Lists all columns in a given table.
        'columns': ['SELECT column_name FROM information_schema.columns WHERE table_name = \'{table_name}\''],
        # Add a new column with the given name, and its definition in a given table.
        'add': ['ALTER TABLE {table_name} ADD COLUMN {column_name} {column_definition}'],
        # Removes the column.
        'remove': ['ALTER TABLE {table_name} DROP COLUMN {column_name}'],
        # Renames the column name.
        'rename': ['ALTER TABLE {table_name} RENAME COLUMN {old_column} TO {new_column}'],
    },
    # Add more entries for other database types if needed
}