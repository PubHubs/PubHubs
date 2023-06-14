FROM golang:1.18 AS yivi_build

RUN git clone https://github.com/privacybydesign/irmago --branch v0.12.0 --depth 1

WORKDIR irmago

RUN go env -w GO111MODULE=auto

RUN go install ./irma

FROM matrixdotorg/synapse:v1.84.0

COPY --from=yivi_build /go/bin//irma /usr/bin/irma

COPY start.sh .

RUN chmod +x start.sh

# Install libpep
RUN apt update && apt install -y lsb-release

RUN sh -c 'printf "deb http://packages.bitpowder.com/debian-%s main core\n" `lsb_release -cs`' | tee /etc/apt/sources.list.d/bitpowder-repo.list
RUN curl -L https://bitpowder.com/packages/linux-packages.gpg | tee /etc/apt/trusted.gpg.d/bitpowder.asc

RUN apt-get update && apt-get install -y pepcli

# Secret to be used by libpep to decrypt the pseudonyms
ENV HUB_SECRET change_me

# Use the modules and templates that are PubHubs specific. To use the modules make sure the configuration in homeserver.yaml points  to the /conf/modules. See the example config.
COPY ./matrix_test_config/templates /conf/templates
COPY ./modules /conf/modules

ENTRYPOINT ["./start.sh"]
