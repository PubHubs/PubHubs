# To be build from the repository's root:
#
#   docker build -f pubhubs_hub/Dockerfile .
#
# Please keep the pubhubs_hub/Dockerfile.dockerignore up-to-date.

### BUILD STAGE:  YIVI
# Should be the same debian version as the version on which synapse is based.
FROM golang:bookworm AS yivi_build


WORKDIR /irmago
RUN git clone https://github.com/privacybydesign/irmago . --branch v0.18.1 --depth 1
RUN GO111MODULE=auto go install ./irma


## FINAL CONTAINER STAGE

FROM ghcr.io/element-hq/synapse:v1.138.0


COPY --from=yivi_build /go/bin/irma /usr/bin/irma
COPY --chmod=755 pubhubs_hub/start.sh .
COPY --chmod=755 pubhubs_hub/start_synaps.sh .

# Use the modules and templates that are PubHubs specific. To use the modules make sure the configuration in homeserver.yaml points  to the /conf/modules. See the example config.
COPY pubhubs_hub/matrix_test_config/templates /conf/templates
COPY pubhubs_hub/modules /conf/modules
COPY --chmod=755 pubhubs_hub/update_config /conf/update_config

COPY pubhubs_hub/assets /non-persistent-data/assets

# Store hub version in '/hub_version'
ARG HUB_VERSION="n/a build time"
RUN echo $HUB_VERSION > 'hub_version'

ENTRYPOINT ["./start.sh"]
