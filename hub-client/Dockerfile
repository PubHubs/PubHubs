FROM node:25-slim AS builder

WORKDIR /usr/src/app
COPY package.json package-lock.json ./
COPY hub-client/package.json ./hub-client/
COPY global-client/package.json ./global-client/
RUN npm ci --ignore-scripts && npm cache clean --force
COPY hub-client/ ./hub-client/
RUN npm run build --workspace=hub-client

FROM nginx:alpine-slim

COPY --from=builder /usr/src/app/hub-client/dist /usr/var/static

COPY hub-client/nginx.conf /etc/nginx/templates/default.conf.template

COPY hub-client/start.sh .
COPY hub-client/rebrand.sh .
COPY hub-client/branding ./branding

RUN chmod +x ./start.sh
RUN chmod +x ./rebrand.sh

EXPOSE 8800

ENV HUB_URL="provide_me_when_running_as_a_container"
ENV PARENT_URL="provide_me_when_running_as_a_container"

CMD ["sh", "-c", "./start.sh && /docker-entrypoint.sh nginx -g 'daemon off;'"]
