#!/usr/bin/env bash

OLD_SYNAPSE_CONFIG_PATH="$SYNAPSE_CONFIG_PATH"
if [ -z "$OLD_SYNAPSE_CONFIG_PATH" ]
then
  OLD_SYNAPSE_CONFIG_PATH="${SYNAPSE_CONFIG_DIR:-/data}/homeserver.yaml"
fi
echo "Old synapse configuration: $OLD_SYNAPSE_CONFIG_PATH"

HOMESERVER_YAML_DIR="$(dirname "${OLD_SYNAPSE_CONFIG_PATH}")"

# Instead of the OLD_SYNAPSE_CONFIG_PATH we want synapse to load our live yaml file: 
export SYNAPSE_CONFIG_PATH="${HOMESERVER_YAML_DIR}/homeserver.live.yaml"

if ./conf/update_config/update_config.py \
	--in "$OLD_SYNAPSE_CONFIG_PATH" \
	--out "$SYNAPSE_CONFIG_PATH" \
	--environment="$UPDATE_CONFIG_ENV"; then
  echo "Configuration update successful. Starting hub..."
  ./start.py
else
  echo "Configuration update failed. Not starting the hub..."
fi




