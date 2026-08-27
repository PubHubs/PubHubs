# Please keep the .dockerignore in the repository root up-to-date.

FROM node:26-slim AS builder

WORKDIR /usr/src/app
COPY package.json package-lock.json ./
COPY hub-client/package.json ./hub-client/
COPY global-client/package.json ./global-client/
# The cache mount keeps the npm download cache across builds on the same machine; --prefer-offline
# then serves the tarballs from it.  --no-audit/--no-fund drop two network round-trips we ignore.
RUN --mount=type=cache,target=/root/.npm \
	npm ci --ignore-scripts --prefer-offline --no-audit --no-fund
COPY hub-client/ ./hub-client/
RUN npm run build --workspace=hub-client

FROM nginx:alpine-slim

COPY --from=builder /usr/src/app/hub-client/dist /usr/var/static
COPY hub-client/nginx.conf /etc/nginx/templates/default.conf.template
COPY --chmod=755 hub-client/start.sh .

EXPOSE 8800

ENV HUB_URL="provide_me_when_running_as_a_container"
ENV PARENT_URL="provide_me_when_running_as_a_container"

CMD ["sh", "-c", "./start.sh && /docker-entrypoint.sh nginx -g 'daemon off;'"]
