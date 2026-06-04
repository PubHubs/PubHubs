# Deploying LiveKit Video Calling for a PubHubs Hub

This document explains how to enable LiveKit-based video calling for a PubHubs hub deployment.

## Overview

PubHubs uses:

- the hub Matrix backend to authenticate users and mint LiveKit tokens
- LiveKit to provide the actual video/audio infrastructure
- the hub client to start and join calls

A working deployment requires:

1. a reachable LiveKit server
2. LiveKit credentials available to the hub Matrix container
3. a public `LIVEKIT_URL` that browsers can connect to
4. reverse proxying for the LiveKit HTTP endpoint

## Required Components

A hub deployment needs:

- a PubHubs hub Matrix service
- a PubHubs hub client
- a LiveKit server
- a reverse proxy such as Caddy or nginx
- LiveKit API credentials:
  - `LIVEKIT_URL`
  - `LIVEKIT_API_KEY`
  - `LIVEKIT_API_SECRET`


## Example 

Only showing passing of environment variables when running the livekit with the Hub container.

```sh
docker run  \
  -e LIVEKIT_URL=https://livekit.pubhubs.ihub.ru.nl \
  -e LIVEKIT_API_KEY=my-key \
  -e LIVEKIT_API_SECRET=my-secret \
  my-hub-image
```