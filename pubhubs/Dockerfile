FROM registry.science.ru.nl/ilab/docker-build/rust-stable:main as builder

COPY ./global-client/ /usr/src/global-client/
COPY ./hub-client/ /usr/src/hub-client/

WORKDIR /usr/src/pubhubs

COPY ./pubhubs/build.rs build.rs
COPY ./pubhubs/static/ static/
COPY ./pubhubs/src/ src/
COPY ./pubhubs/Cargo.toml .
COPY ./pubhubs/Cargo.lock .

RUN apt-get update && apt-get install -y npm

ARG CARGO_FEATURES

# Build global client
RUN npm ci --prefix ../global-client
RUN npm ci --prefix ../hub-client
RUN npm run --prefix ../global-client build
RUN cp -a ../global-client/dist/. static/assets/client

RUN cargo install $CARGO_FEATURES --path .

FROM debian:oldstable-slim
RUN apt-get update && apt-get install -y curl lsb-release && rm -rf /var/lib/apt/lists/*

# TODO now on main, on stable release use stable
RUN sh -c 'printf "deb http://packages.bitpowder.com/debian-%s main core\n" `lsb_release -cs`' | tee /etc/apt/sources.list.d/bitpowder-repo.list
RUN curl -L https://bitpowder.com/packages/linux-packages.gpg | tee /etc/apt/trusted.gpg.d/bitpowder.asc

RUN apt-get update && apt-get install -y pepcli

COPY --from=builder /root/.cargo/bin/pubhubs /usr/local/bin/pubhubs
COPY --from=builder /usr/src/pubhubs/static/ static/

COPY ./pubhubs/default.yaml .

ENV PUBHUBS_CONFIG="provide_me_when_running_as_a_container"
ENV PUBHUBS_URL="provide_me_when_running_as_a_container"

CMD echo "const _env = {\"PUBHUBS_URL\": \"$PUBHUBS_URL\"}" > /static/assets/client/client-config.js && pubhubs
