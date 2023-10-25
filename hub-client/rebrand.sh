# local test from /hub-client for the first testhub:
# ./rebrand.sh testclient testclient0_8801 8801 http://localhost:8008 http://localhost:8080

CONTAINER=$1        # Name of the running hub Docker container
PORT=$2             # Port of the hub container
HUB_URL=$3          # URL of Hub (homeserver)
PARENT_URL=$4       # URL of PubHubs Central
PUBHUBS_BRANDING=$5 # Add p to return to standard branding
LOCAL=$6            # Add l if you run the script on your local machine instead of the server


BLUE='\x1b[35m'
NOCOLOR='\033[0m'

echo "\n\n${BLUE}Rebranding Hub";
echo "==============";

if [ "$LOCAL" = "l" ]
then
    IMAGE="testclient"
    echo "Local image: $IMAGE";
else
    IMAGE="registry.science.ru.nl/ilab/pubhubs_canonical/pubhubs_client:main"
    echo "Hub image: $IMAGE";
fi
echo "${NOCOLOR}\n\n"


if [ "$PUBHUBS_BRANDING" = "p" ]
then
    echo "Back to default PubHubs theme & logo"
else
    echo "New Hub theme & logo"
fi
echo "${NOCOLOR}\n\n"


# Rebuild docker
docker stop $CONTAINER
docker rm $CONTAINER

echo "\n${BLUE}Rebuilding${NOCOLOR}\n\n";
if [ "$PUBHUBS_BRANDING" = "p" ]
then
    docker build -t $IMAGE -f Dockerfile .
else
    docker build -t $IMAGE -f Dockerfile.branding .
fi

# Run container
echo "\n${BLUE}Running${NOCOLOR}\n";

if [ "$LOCAL" = "l" ]
then
    docker run --name $CONTAINER -e PORT=$PORT  -e "BAR_URL=frame-ancestors $PARENT_URL" -e "HUB_URL=$HUB_URL" -e "PARENT_URL=$PARENT_URL" -d -p $PORT:8800 $IMAGE
else
    docker run --env "BAR_URL=frame-ancestors $PARENT_URL;" --env "HUB_URL=$HUB_URL" --env "PARENT_URL=$PARENT_URL"  -p $PORT:8800 $IMAGE
fi

# If rebrand, copy logo for PubHubs Central
if [ "$PUBHUBS_BRANDING" = "p" ]
then
    echo "\n${BLUE}No logo copied${NOCOLOR}\n"
else
    echo "\n${BLUE}Copy logo${NOCOLOR}\n"
    docker cp ./branding/logo.svg $CONTAINER:/usr/var/static/img/logo.svg
fi

echo "\n${BLUE}Done!\n=====${NOCOLOR}\n\n";
