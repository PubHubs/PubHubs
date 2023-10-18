# To be build from the repository's root:
#
#   docker build -f pubhubs_hub/Dockerfile .
#
# Please keep the pubhubs_hub/Dockerfile.dockerignore up-to-date. 

### BUILD STAGE:  YIVI
# bullseye tag since the synapse image is based on bullseye.
FROM golang:bookworm AS yivi_build

RUN git clone https://github.com/privacybydesign/irmago --branch v0.14.1 --depth 1

WORKDIR irmago

RUN GO111MODULE=auto go install ./irma

### BUILD STAGE:  LIBPUBHUBS 
FROM rust:bookworm AS libpubhubs_build

COPY pubhubs/ wd

WORKDIR wd

# only build pubhubs with the features needed for the ABI
RUN cargo build --no-default-features --lib --features=abi

## FINAL CONTAINER STAGE
FROM matrixdotorg/synapse:v1.94.0

COPY --from=yivi_build /go/bin/irma /usr/bin/irma
COPY --from=libpubhubs_build /wd/target/debug/libpubhubs.so /usr/lib
COPY --chmod=755 pubhubs_hub/start.sh .

# Secret to be used by libpep to decrypt the pseudonyms
ENV HUB_SECRET change_me

# Use the modules and templates that are PubHubs specific. To use the modules make sure the configuration in homeserver.yaml points  to the /conf/modules. See the example config.
COPY pubhubs_hub/matrix_test_config/templates /conf/templates
COPY pubhubs_hub/modules /conf/modules

ENTRYPOINT ["./start.sh"]
