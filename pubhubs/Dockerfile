FROM registry.science.ru.nl/ilab/docker-build/rust-stable:main AS builder

COPY ./src/ src/
COPY ./Cargo.toml .
COPY ./Cargo.lock .

ARG PH_VERSION

RUN PH_VERSION=$PH_VERSION cargo install --path .

FROM debian:stable-slim
RUN apt-get update && apt-get install -y curl lsb-release && rm -rf /var/lib/apt/lists/*

COPY --from=builder /root/.cargo/bin/pubhubs /usr/local/bin/pubhubs

CMD pubhubs
