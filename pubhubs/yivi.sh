#!/usr/bin/env sh

# This script runs a yivi server for local development of the pubhubs servers

docker run --rm \
           -p 8188:8188 \
           -p 8199:8199 \
	   -v ./yivi.toml:/yivi.toml \
	   -v ./yivi_jwt.pem:/yivi_jwt.pem \
	   ghcr.io/privacybydesign/irma:latest  \
	   	server -c /yivi.toml -v --sse

