#!/usr/bin/env bash

# Note that the irma (yivi) server will not be publicly accessible (only through a proxy hosted by the hub), so using --allow-unsigned-callbacks should be safe
irma server --issue-perms "*" --production --no-email --no-tls --sse --allow-unsigned-callbacks --no-auth -l 0.0.0.0 -p 8089 --client-listen-addr 0.0.0.0 --client-port 8088 &

export SYNAPSE_CONFIG_PATH=/data/homeserver.live.yaml

if [ "$DONT_START_HUB" = 1 ]
then
  echo 'Will not start the hub. Do so manually by running ./start_synaps.sh from inside the container'
else 
  if ./conf/update_config/update_config.py --in '/data/homeserver.yaml' --out "$SYNAPSE_CONFIG_PATH" --environment="$UPDATE_CONFIG_ENV"; then
    echo "Configuration update successful. Starting hub..."
    ./start.py
  else
    echo "Configuration update failed. Not starting the application."
    exit 1
  fi
fi

wait -n




