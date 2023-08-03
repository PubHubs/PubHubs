FROM golang:1.20

RUN git clone https://github.com/privacybydesign/irmago --branch v0.12.6 --depth 1

WORKDIR irmago

RUN GO111MODULE=auto go install ./irma

EXPOSE 8088

COPY irmaserver.yaml .
COPY jwt.priv .

CMD ["irma", "server", "-vvvvvv", "--no-tls", "--sse", "--allow-unsigned-callbacks"]
