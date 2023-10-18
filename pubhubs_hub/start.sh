#!/usr/bin/env bash

irma server --issue-perms "*" --production --no-email --no-tls --sse --allow-unsigned-callbacks --no-auth -l 0.0.0.0 -p 8089 --client-listen-addr 0.0.0.0 --client-port 8088 -vvvvvvvvv &

if [ $DONT_START_HUB -eq 1 ]
then
  echo 'Will not start the hub. Do so manually by running ./start.py from inside the container'
  sleep infinity
  exit 0
fi

./start.py
