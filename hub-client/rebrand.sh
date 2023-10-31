# This is an example of how rebranding can work
# ./rebrand.sh testclient0_8801 h

CONTAINER=$1        # Name of the running hub Docker container
PUBHUBS_BRANDING=$2 # Add p to return to standard branding

BLUE='\x1b[35m'
NOCOLOR='\033[0m'

echo "\n\n${BLUE}Rebranding Hub";
echo "==============";

if [ "$PUBHUBS_BRANDING" = "p" ]
then
    echo "Back to default PubHubs theme & logo"
else
    echo "New Hub theme & logo"
fi
echo "${NOCOLOR}\n\n"


if [ "$PUBHUBS_BRANDING" = "p" ]
then
    echo "\n${BLUE}Restore PubHubs theme (logo's and styling)${NOCOLOR}\n"
    # Original Logo's
    docker cp ./public/img/pubhubslogos/logo.svg $CONTAINER:/usr/var/static/img/logo.svg
    docker cp ./public/img/pubhubslogos/logo-dark.svg $CONTAINER:/usr/var/static/img/logo-dark.svg
    # Remove styling
    docker exec -it $CONTAINER sh -c 'rm /usr/var/static/branding.css'
else
    echo "\n${BLUE}Copy branding (logo's and styling)${NOCOLOR}\n"
    # Logo's
    docker cp ./branding/logo.svg $CONTAINER:/usr/var/static/img/logo.svg
    docker cp ./branding/logo-dark.svg $CONTAINER:/usr/var/static/img/logo-dark.svg
    # Styling
    docker cp ./branding/branding.css $CONTAINER:/usr/var/static/branding.css
fi

# Add new timestamp, so logo's will not be cached
timestamp=$(date +%s)
echo "\n${BLUE}New timestamp: ${timestamp}\n${NOCOLOR}"
docker exec -it $CONTAINER sh -c 'timestamp=$(date +%s); sed -E -i".bak" "s/(\"TIMESTAMP\".?:.?\").*\"/\1${timestamp}\"/g" /usr/var/static/client-config.js'

echo "\n${BLUE}Done!\n=====${NOCOLOR}\n\n";
