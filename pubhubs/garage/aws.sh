#!/usr/bin/env bash

docker run \
-e AWS_ACCESS_KEY_ID=GK4ab65ecd61df5cd9382075c5 \
-e AWS_SECRET_ACCESS_KEY=c46af3789d8f98b527538e4eeea6c1130e1356b694f391fa6f9af5098121e50f \
-e AWS_DEFAULT_REGION=garage \
-e AWS_ENDPOINT_URL='http://host.docker.internal:3900' \
--rm -it amazon/aws-cli s3 "$@"
