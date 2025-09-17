#!/usr/bin/env sh

# This script runs a yivi server for local development of the pubhubs servers

if !which irma
then
	echo "please add 'irma' to your path"
	echo ""
	echo "for instructions on installing 'irma', see:"
	echo "  https://github.com/privacybydesign/irmago"
	exit 1
fi

irma server -c yivi.toml -vv --sse

