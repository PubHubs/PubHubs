#!/bin/bash
set -eu
set -o pipefail

MATRIX_TEST_CONFIG=pubhubs_hub/matrix_test_config

# Add permissions so mounted volume in synapse can be accessed by synapse.
# Remove these steps if you want to change the permissions manually
chmod 777 $MATRIX_TEST_CONFIG
chmod 777 "$MATRIX_TEST_CONFIG/homeserver.yaml"
chmod 777 "$MATRIX_TEST_CONFIG/test_hub.log.config"
chmod 777 "$MATRIX_TEST_CONFIG/testhub.signing.key"

docker compose up -d

if ! curl -X GET -I  http://localhost:8080/ | grep "200 OK"; then
  echo "Make sure pub hubs is running!"
  exit 1
fi

ADMH="X-Admin-API-Key: api_key"

# Create test hub if not exists
if HUBID=$( curl -X GET -H "$ADMH" -f http://localhost:8080/admin/hubid/testhub); then
  echo "  Test hub exists"
else
  curl -X POST http://localhost:8080/admin/hubs -H "$ADMH" -H "Content-Type: application/x-www-form-urlencoded"  -d "name=testhub&=description=testhub&description=test_hub_description&redirection_uri=http://localhost:8008/_synapse/client/oidc/callback"
  if ! HUBID=$(curl -X GET -H "$ADMH" -f http://localhost:8080/admin/hubid/testhub); then
    echo "failed to retrieve HUBID after creation of the hub"
    exit 1
  fi
fi

echo "requesting test hub's ($HUBID) secret.."
# Please don't be clever and replace the following two lines with
#     export HUB_SECRET=$(curl -f ...)
# because in that case the exit code of curl will be ignored.
HUB_SECRET=$(curl -H "$ADMH" -f "localhost:8080/admin/hubs/${HUBID}?secret")
export HUB_SECRET

echo "  hub secret: $HUB_SECRET"

cd pubhubs_hub

docker compose up -d --build --force-recreate

