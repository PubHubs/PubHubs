FROM registry.science.ru.nl/ilab/docker-build/rust-stable:main as builder
WORKDIR /usr/src/pubhubs
COPY build.rs build.rs
COPY static/ static/
COPY src/ src/
COPY Cargo.toml .
COPY Cargo.lock .

RUN apt-get update && apt-get install -y npm

ARG CARGO_FEATURES

RUN cargo install $CARGO_FEATURES --path .

FROM debian:stable-slim
RUN apt-get update && apt-get install -y curl lsb-release && rm -rf /var/lib/apt/lists/*

# TODO now on main, on stable release use stable
RUN sh -c 'printf "deb http://packages.bitpowder.com/debian-%s main core\n" `lsb_release -cs`' | tee /etc/apt/sources.list.d/bitpowder-repo.list
RUN curl -L https://bitpowder.com/packages/linux-packages.gpg | tee /etc/apt/trusted.gpg.d/bitpowder.asc

RUN apt-get update && apt-get install -y pepcli

COPY --from=builder /root/.cargo/bin/pubhubs /usr/local/bin/pubhubs
COPY --from=builder /usr/src/pubhubs/static/ static/
COPY default.yaml .

# TODO change on deployment obviously maybe even just set something that will fail! Much better I guess.
ENV PUBHUBS_CONFIG="default.yaml"

CMD ["pubhubs"]
