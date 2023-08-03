# To be build from the repository's root:
#
#   docker build -f pubhubs_hub/Dockerfile .
#
# Please keep the pubhubs_hub/Dockerfile.dockerignore up-to-date. 

### BUILD STAGE:  YIVI
FROM golang:1.20 AS yivi_build

RUN git clone https://github.com/privacybydesign/irmago --branch v0.12.6 --depth 1

WORKDIR irmago

RUN GO111MODULE=auto go install ./irma

### BUILD STAGE:  LIBPUBHUBS 
FROM rust AS libpubhubs_build

COPY pubhubs/ .
# only build pubhubs with the features needed for the ABI
RUN cargo build --no-default-features --lib --features=abi

## FINAL CONTAINER STAGE
FROM matrixdotorg/synapse:v1.89.0

COPY --from=yivi_build /go/bin/irma /usr/bin/irma
COPY --from=libpubhubs_build /target/debug/libpubhubs.so /usr/lib
COPY --chmod=755 pubhubs_hub/start.sh .

# Secret to be used by libpep to decrypt the pseudonyms
ENV HUB_SECRET change_me

# Use the modules and templates that are PubHubs specific. To use the modules make sure the configuration in homeserver.yaml points  to the /conf/modules. See the example config.
COPY pubhubs_hub/matrix_test_config/templates /conf/templates
COPY pubhubs_hub/modules /conf/modules

ENTRYPOINT ["./start.sh"]
