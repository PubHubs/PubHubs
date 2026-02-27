# Please keep the pubhubs_hub/Dockerfile.dockerignore up-to-date.
#
# To be built from the pubhubs_hub directory

### BUILD STAGE:  YIVI
# Should be the same debian version as the version on which synapse is based.
FROM golang:trixie AS yivi_build

WORKDIR /irmago
RUN git clone https://github.com/privacybydesign/irmago . --branch v0.19.2 --depth 1
RUN GO111MODULE=auto go install ./irma


## FINAL CONTAINER STAGE

FROM ghcr.io/element-hq/synapse:v1.146.0

COPY --from=yivi_build /go/bin/irma /usr/bin/irma

RUN apt-get update && \
	apt-get install -y -q postgresql sudo && \
	rm -rf /var/lib/apt/lists/* && \
	rm -rf /etc/postgres # the database goes in /data/postgres instead

COPY modules /conf/modules
COPY assets /non-persistent-data/assets
COPY --chmod=755 boot /conf/boot

# Store hub version in '/hub_version'
ARG HUB_VERSION="n/a"
RUN echo $HUB_VERSION > 'hub_version'

ENTRYPOINT ["/conf/boot/start_hub.py"]
