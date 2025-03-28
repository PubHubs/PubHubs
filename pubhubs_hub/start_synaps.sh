#!/usr/bin/env bash
# If you are using watch_modules=1 you should use this script to start synaps from within the docker container
# If you really do not want to run the update_config script you can run start.py in the docker container
# But make sure the homeserver.live.yaml file is present in the hub folder
# TODO update_config is not part of the modules so is not updated when you restart the hub with watch_modules = 1
export SYNAPSE_CONFIG_PATH=/data/homeserver.live.yaml


if ./conf/update_config/update_config.py --in '/data/homeserver.yaml' --out "$SYNAPSE_CONFIG_PATH" --environment="$UPDATE_CONFIG_ENV"; then
  echo "Configuration update successful. Starting hub..."
  ./start.py
else
  echo "Configuration update failed. Not starting the application."
  exit 1
fi




