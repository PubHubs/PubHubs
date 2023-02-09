FROM node:19-slim as builder
COPY . .
RUN npm install
RUN npm run build

FROM nginxinc/nginx-unprivileged:alpine-slim

COPY --from=builder dist /usr/var/static

COPY nginx.conf /etc/nginx/templates/default.conf.template

EXPOSE 8800