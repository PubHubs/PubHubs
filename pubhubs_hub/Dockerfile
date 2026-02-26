# Please keep the pubhubs_hub/Dockerfile.dockerignore up-to-date.
#
# To be built from the pubhubs_hub directory

### BUILD STAGE:  YIVI
# Should be the same debian version as the version on which synapse is based.
FROM golang:trixie AS yivi_build

WORKDIR /irmago
RUN git clone https://github.com/privacybydesign/irmago . --branch v0.19.1 --depth 1
RUN GO111MODULE=auto go install ./irma


### BUILD STAGE: synapse_auto_compressor
# Should be the same debian version as the version on which synapse is based.
FROM rust:trixie AS compress_state_build

RUN cargo install --git https://github.com/matrix-org/rust-synapse-compress-state \
    synapse_auto_compressor


## FINAL CONTAINER STAGE

FROM ghcr.io/element-hq/synapse:v1.146.0

COPY --from=yivi_build /go/bin/irma /usr/bin/irma
COPY --from=compress_state_build /usr/local/cargo/bin/synapse_auto_compressor \
     /usr/local/bin/synapse_auto_compressor

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
