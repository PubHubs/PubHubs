FROM golang:1.17.6

RUN git clone https://github.com/privacybydesign/irmago

WORKDIR irmago

# version 0.10.0
RUN git reset 62cb8aa430ca6cd2fdf2aa379743c315fff1a6cf
#RUN git reset 5a14bccc721d74a6857445145331523f2b130ebc 0.9.0

RUN go env -w GO111MODULE=auto

RUN go install ./irma

EXPOSE 8088

COPY docker_irma/irmaserver.yaml .
COPY docker_irma/jwt.priv .

CMD ["irma", "server", "-vvvvvv", "--no-tls", "--sse", "--allow-unsigned-callbacks"]
#"-u", "http://172.18.0.2:8088"
