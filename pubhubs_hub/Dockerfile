# Please keep the pubhubs_hub/Dockerfile.dockerignore up-to-date.
#
# To be built from the pubhubs_hub directory

### BUILD STAGE:  YIVI
# Should be the same debian version as the version on which synapse is based.
FROM golang:bookworm AS yivi_build

WORKDIR /irmago
RUN git clone https://github.com/privacybydesign/irmago . --branch v0.18.1 --depth 1
RUN GO111MODULE=auto go install ./irma


## FINAL CONTAINER STAGE

FROM ghcr.io/element-hq/synapse:v1.143.0

COPY --from=yivi_build /go/bin/irma /usr/bin/irma

COPY modules /conf/modules
COPY assets /non-persistent-data/assets
COPY --chmod=755 boot /conf/boot

# Store hub version in '/hub_version'
ARG HUB_VERSION="n/a"
RUN echo $HUB_VERSION > 'hub_version'

ENTRYPOINT ["/conf/boot/start_hub.py"]
