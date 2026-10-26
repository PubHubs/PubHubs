# Please keep the pubhubs_hub/Dockerfile.dockerignore up-to-date.
#
# To be built from the pubhubs_hub directory

### BUILD STAGE:  YIVI
# Should be the same debian version as the version on which synapse is based.
FROM golang:trixie AS yivi_build

WORKDIR /irmago
# Since v1.x the CLI is the `yivi` binary; the old `irma` command is now the `yivi irma` subcommand.
RUN git clone https://github.com/privacybydesign/irmago . --branch v1.3.1 --depth 1 && \
	go install ./yivi

## FINAL CONTAINER STAGE

FROM ghcr.io/element-hq/synapse:v1.160.0

COPY --from=yivi_build /go/bin/yivi /usr/bin/yivi
# Pinned: `latest` makes the build unreproducible and forces a registry round-trip every build.
# v1.13.5 is what `latest` resolved to when this was pinned.
COPY --from=livekit/livekit-server:v1.13.5 /livekit-server /usr/bin/livekit-server
COPY --chmod=755 config/local/livekit.local.yaml /conf/livekit.local.yaml
COPY --chmod=755 config/local/sygnal.local.yaml /conf/sygnal.local.yaml

# Sygnal (Matrix push gateway, see modules/pubhubs/_push_gateway_proxy.py) in its own venv,
# deliberately isolated from Synapse's: matrix-sygnal and matrix-synapse are separate Matrix.org
# projects that happen to share a dependency family (Twisted, attrs, prometheus_client, ...), and
# pip installing it straight into Synapse's environment risks a version resolution silently
# up/downgrading one of Synapse's own pins. Only started when a hub opts in with a /data/sygnal.yaml
# (see boot/start_hub.py) - disabled by default, so this costs every hub some image size but nothing
# at runtime unless configured. Sygnal isn't published on PyPI, so it's installed from its pinned
# GitHub release instead.
RUN python3 -m venv /opt/sygnal-venv && \
	/opt/sygnal-venv/bin/pip install --no-cache-dir https://github.com/element-hq/sygnal/archive/refs/tags/v0.17.0.tar.gz

# One layer on purpose: each of these steps used to be its own RUN, and every layer costs another
# image layer plus its own filesystem snapshot.
#
# - LiveKit: install the API package only.  Do not install the `livekit` client package here: it
#   pulls numpy wheels that require x86_64-v2 and crash on older CPUs.
# - Post-quantum HHPP verification (modules/pubhubs/_hhpp.py) needs ML-DSA, which requires
#   cryptography>=48 (its manylinux wheels bundle OpenSSL 3.5); the synapse base image ships an
#   older one.  Keep in sync with the floor in requirements.txt.  The hub refuses to start without
#   it.  Also upgrade pyOpenSSL: cryptography>=49 removed the _lib.GEN_EMAIL binding that the base
#   image's older pyOpenSSL references at import ("AttributeError: module 'lib' has no attribute
#   'GEN_EMAIL'").
# - /etc/postgres is removed because the database goes in /data/postgres instead.
RUN pip install --no-cache-dir livekit-api && \
	pip install --no-cache-dir --upgrade 'cryptography>=48.0.0' 'pyOpenSSL>=26.3.0' && \
	apt-get update && \
	apt-get install -y -q postgresql sudo && \
	rm -rf /var/lib/apt/lists/* /etc/postgres

COPY modules /conf/modules
COPY assets /non-persistent-data/assets
COPY --chmod=755 boot /conf/boot

# Store hub version in '/hub_version'.  Kept last on purpose: HUB_VERSION changes on every build,
# so nothing after it can ever be cached.
ARG HUB_VERSION="n/a"
RUN echo $HUB_VERSION > 'hub_version'

ENTRYPOINT ["/conf/boot/start_hub.py"]
