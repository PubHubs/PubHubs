FROM golang:1.18

RUN git clone https://github.com/privacybydesign/irmago --branch v0.11.0 --depth 1

WORKDIR irmago

RUN go env -w GO111MODULE=auto

RUN go install ./irma

EXPOSE 8088

COPY docker_irma/irmaserver.yaml .
COPY docker_irma/jwt.priv .

CMD ["irma", "server", "-vvvvvv", "--no-tls", "--sse", "--allow-unsigned-callbacks"]
#"-u", "http://172.18.0.2:8088"
