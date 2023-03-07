FROM node:19-slim as builder
COPY . .
RUN npm install
RUN npm run build

FROM nginx:alpine-slim

COPY --from=builder dist /usr/var/static

COPY nginx.conf /etc/nginx/templates/default.conf.template

COPY start.sh .

RUN chmod +x ./start.sh

EXPOSE 8800

CMD ./start.sh && /docker-entrypoint.sh nginx -g "daemon off;"