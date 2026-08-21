# Please keep the pubhubs/Dockerfile.dockerignore up-to-date.

FROM registry.science.ru.nl/ilab/docker-build/rust-stable:main@sha256:568ab075dcbbe71e67c61e1b36d3f4f9386fe9d3025a669f88b9ad3979abd8b9 AS chef
WORKDIR /app
RUN cargo install cargo-chef --locked --version 0.1.78
ENV CARGO_TARGET_DIR=/app/target

FROM chef AS planner
COPY ./src/ src/
COPY ./Cargo.toml ./Cargo.lock ./
RUN cargo chef prepare --recipe-path recipe.json

FROM chef AS builder
COPY --from=planner /app/recipe.json recipe.json

RUN mkdir -p tests && touch tests/integration.rs && \
	cargo chef cook --release --locked --recipe-path recipe.json

COPY ./src/ src/
COPY ./Cargo.toml ./Cargo.lock ./


ARG PH_VERSION
RUN PH_VERSION=$PH_VERSION cargo build --release --locked

FROM debian:stable-slim
RUN apt-get update && apt-get install -y curl lsb-release && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/pubhubs /usr/local/bin/pubhubs

CMD ["pubhubs"]
