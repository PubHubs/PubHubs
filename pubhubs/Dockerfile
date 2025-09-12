FROM registry.science.ru.nl/ilab/docker-build/rust-stable:main AS builder

WORKDIR /usr/src/global-client
COPY ./global-client/package.json ./global-client/package-lock.json ./
RUN npm ci && npm cache clean --force
WORKDIR /usr/src/hub-client
COPY ./hub-client/package.json ./hub-client/package-lock.json ./
RUN npm ci && npm cache clean --force

WORKDIR /usr/src/pubhubs
COPY ./pubhubs/build.rs .
COPY ./pubhubs/static/ static/
COPY ./pubhubs/src/ src/
COPY ./pubhubs/Cargo.toml .
COPY ./pubhubs/Cargo.lock .

RUN apt-get update && apt-get install -y npm

ARG CARGO_FEATURES
ARG PH_VERSION

RUN PH_VERSION=$PH_VERSION cargo install $CARGO_FEATURES --path .

# Build global client
COPY ./global-client/ ../global-client/
COPY ./hub-client/ ../hub-client/
RUN npm run --prefix ../global-client build

FROM debian:stable-slim
RUN apt-get update && apt-get install -y curl lsb-release && rm -rf /var/lib/apt/lists/*

COPY --from=builder /root/.cargo/bin/pubhubs /usr/local/bin/pubhubs
COPY --from=builder /usr/src/pubhubs/static/ static/

COPY ./pubhubs/default.yaml .

ENV PUBHUBS_CONFIG="provide_me_when_running_as_a_container"
ENV PUBHUBS_URL="provide_me_when_running_as_a_container"

CMD echo "const _env = {\"PUBHUBS_URL\": \"$PUBHUBS_URL\", \"PHC_URL\": \"$PHC_URL\"}" > /static/assets/client/client-config.js && pubhubs
