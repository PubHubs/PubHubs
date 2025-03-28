# To be build from the repository's root:
#
#   docker build -f pubhubs_hub/Dockerfile .
#
# Please keep the pubhubs_hub/Dockerfile.dockerignore up-to-date.

### BUILD STAGE:  YIVI
# Should be the same debian version as the version on which synapse is based.
FROM golang:bookworm AS yivi_build

RUN git clone https://github.com/privacybydesign/irmago --branch v0.17.0 --depth 1

WORKDIR irmago

RUN GO111MODULE=auto go install ./irma

### BUILD STAGE:  LIBPUBHUBS
# Should be the same debian version as the version on which synapse is based.
FROM rust:bookworm AS libpubhubs_build

COPY pubhubs/ wd

WORKDIR wd

# only build pubhubs with the features needed for the ABI
RUN cargo build --no-default-features --lib --features=abi

## FINAL CONTAINER STAGE

FROM ghcr.io/element-hq/synapse:v1.126.0


COPY --from=yivi_build /go/bin/irma /usr/bin/irma
COPY --from=libpubhubs_build /wd/target/debug/libpubhubs.so /usr/lib
COPY --chmod=755 pubhubs_hub/start.sh .
COPY --chmod=755 pubhubs_hub/start_synaps.sh .

# Secret to be used by libpep to decrypt the pseudonyms
ENV HUB_SECRET change_me

# Use the modules and templates that are PubHubs specific. To use the modules make sure the configuration in homeserver.yaml points  to the /conf/modules. See the example config.
COPY pubhubs_hub/matrix_test_config/templates /conf/templates
COPY pubhubs_hub/modules /conf/modules
COPY --chmod=755 pubhubs_hub/update_config /conf/update_config

COPY pubhubs_hub/assets /non-persistent-data/assets

# Store hub version in '/hub_version'
ARG HUB_VERSION="n/a build time"
RUN echo $HUB_VERSION > 'hub_version'

ENTRYPOINT ["./start.sh"]
