# Add new timestamp to client-config.js, for cache busting logo's
timestamp=$(date +%s)
sed -E -i".bak" "s/(\"TIMESTAMP\".?:.?\").*\"/\1${timestamp}\"/g" public/client-config.js
