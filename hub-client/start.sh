TIMESTAMP=$(date +%s)
echo "const _env = {\"HUB_URL\": \"$HUB_URL\",\"PARENT_URL\": \"$PARENT_URL\",\"TIMESTAMP\": \"$TIMESTAMP\"}" > /usr/var/static/client-config.js
