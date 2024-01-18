# This is an example of to install the plugins
# ./install_plugins.sh testclient0_8801

# The way plugins are installed to a running container will change in the future. But for now this may be handy.


CONTAINER=$1      # Name of the running Docker container of the hub client.
UNINSTALL=$2      # Add u to uninstall plugins

PLUGINROOT=plugins
PLUGINSRC=src/plugins
STATICFOLDER='/usr/var/static'

if [ "$UNINSTALL" = "u" ]
then
    echo "\nUninstall Plugins"
    echo "=================\n"
    rm -R $PLUGINSRC/*
else
    echo "\nInstall Plugins"
    echo "===============\n"
    plugins=`ls $PLUGINROOT`
    for plugin in $plugins
    do
      echo "$plugin"
      cp -R $PLUGINROOT/$plugin $PLUGINSRC
    done
fi

echo "\nRebuilding";
echo "==========\n";

npm run build

echo "\nInstalling on container";
echo "=======================\n";

cd ./dist
docker stop $CONTAINER
docker cp ./ $CONTAINER:/usr/var/static

echo "\nRestarting container";
echo "====================\n";

docker start $CONTAINER

echo "\nDone!"
echo "=====\n\n";

cd ..
