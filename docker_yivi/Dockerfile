FROM golang:trixie

RUN git clone https://github.com/privacybydesign/irmago --branch v1.1.1 --depth 1

WORKDIR irmago

# Since v1.x the CLI is the `yivi` binary; the old `irma` command is now the `yivi irma` subcommand.
RUN go install ./yivi

EXPOSE 8088

COPY irmaserver.yaml .
# Note that this container is only used in development, so we can safely store the private key inside the repo.
COPY jwt.priv .

CMD ["yivi", "irma", "server", "-vvvvvv", "--no-tls", "--sse", "--allow-unsigned-callbacks"]
