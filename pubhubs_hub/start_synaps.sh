#!/usr/bin/env bash
# If you are using watch_modules=1 you should use this script to start synaps from within the docker container
# If you really do not want to run the update_config script you can run start.py in the docker container
# But make sure the homeserver.live.yaml file is present in the hub folder
# TODO update_config is not part of the modules so is not updated when you restart the hub with watch_modules = 1
# We want to figure out the location of homeserver.yaml that synaps will load. It depends on two environmental variables, see https://github.com/element-hq/synapse/blob/3c188231c76ee8c05a6a40d12ccfdebada86b406/docker/start.py#L160
OLD_SYNAPSE_CONFIG_PATH="$SYNAPSE_CONFIG_PATH"
if [ -z "$OLD_SYNAPSE_CONFIG_PATH" ]
then
  OLD_SYNAPSE_CONFIG_PATH="${SYNAPSE_CONFIG_DIR:-/data}/homeserver.yaml"
fi
echo "Old synapse configuration: $OLD_SYNAPSE_CONFIG_PATH"

HOMESERVER_YAML_DIR="$(dirname "${OLD_SYNAPSE_CONFIG_PATH}")"

# Instead of the OLD_SYNAPSE_CONFIG_PATH we want synaps to load our live yaml file: 
export SYNAPSE_CONFIG_PATH="${HOMESERVER_YAML_DIR}/homeserver.live.yaml"

if ./conf/update_config/update_config.py --in "$OLD_SYNAPSE_CONFIG_PATH" --out "$SYNAPSE_CONFIG_PATH" --environment="$UPDATE_CONFIG_ENV"; then
  echo "Configuration update successful. Starting hub..."
  ./start.py
else
  echo "Configuration update failed. Not starting the hub..."
fi




