FROM node:24-slim AS builder

WORKDIR /usr/src/app
COPY package.json package-lock.json ./
RUN npm ci && npm cache clean --force
COPY . . 
RUN npm run build

FROM nginx:alpine-slim

COPY --from=builder /usr/src/app/dist /usr/var/static 

COPY nginx.conf /etc/nginx/templates/default.conf.template

COPY start.sh .
COPY rebrand.sh .
COPY branding ./branding

RUN chmod +x ./start.sh
RUN chmod +x ./rebrand.sh

EXPOSE 8800

ENV HUB_URL="provide_me_when_running_as_a_container"
ENV PARENT_URL="provide_me_when_running_as_a_container"

CMD ./start.sh && /docker-entrypoint.sh nginx -g "daemon off;"
