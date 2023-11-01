# This is an example of how rebranding can work
# ./rebrand.sh testclient0_8801 h

CONTAINER=$1        # Name of the running Docker container of the hub client.
PUBHUBS_BRANDING=$2 # Add p to return to standard PubHubs branding. Anything else (or nothing) will install the new branding.

BRANDING_FOLDER='/branding'
STATICFOLDER='/usr/var/static'

echo "Rebranding Hub";
echo "==============";

if [ "$PUBHUBS_BRANDING" = "p" ]
then
    echo "Back to default PubHubs theme & logo"
else
    echo "New Hub theme & logo"
fi
echo ""


if [ "$PUBHUBS_BRANDING" = "p" ]
then
    echo "Restore PubHubs theme (logo's and styling)"
    # Original Logo's
    cp $BRANDING_FOLDER/pubhubslogos/logo.svg $STATICFOLDER/img/logo.svg
    cp $BRANDING_FOLDER/pubhubslogos/logo-dark.svg $STATICFOLDER/img/logo-dark.svg
    # Remove styling
    rm $STATICFOLDER/branding.css
else
    echo "Copy branding (logo's and styling)"
    # Logo's
    cp $BRANDING_FOLDER/logo.svg $STATICFOLDER/img/logo.svg
    cp $BRANDING_FOLDER/logo-dark.svg $STATICFOLDER/img/logo-dark.svg
    # Styling
    cp $BRANDING_FOLDER/branding.css $STATICFOLDER/branding.css
fi

# Add new timestamp, so logo's will not be cached
timestamp=$(date +%s)
echo "New timestamp: ${timestamp}"
sed -E -i".bak" "s/(\"TIMESTAMP\".?:.?\").*\"/\1${timestamp}\"/g" $STATICFOLDER/client-config.js

echo "Done!"
echo "=====";
