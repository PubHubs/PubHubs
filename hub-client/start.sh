sed -i "s|http://localhost:8008|https://$VUE_APP_BASEURL|g" /usr/var/static/js/*.js.map
sed -i "s|http://localhost:8008|https://$VUE_APP_BASEURL|g" /usr/var/static/js/*.js
sed -i "s|http://localhost:8008|https://$VUE_APP_BASEURL|g" /usr/var/static/js/*.*.js
sed -i "s|http://localhost:8008|https://$VUE_APP_BASEURL|g" /usr/var/static/js/*.*.js.map

sed -i "s|localhost:8008|$VUE_APP_BASEURL|g" /usr/var/static/js/*.js.map
sed -i "s|localhost:8008|$VUE_APP_BASEURL|g" /usr/var/static/js/*.js
sed -i "s|localhost:8008|$VUE_APP_BASEURL|g" /usr/var/static/js/*.*.js
sed -i "s|localhost:8008|$VUE_APP_BASEURL|g" /usr/var/static/js/*.*.js.map
