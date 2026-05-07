# Issues encountered during deployment

## Reverse proxy configuration issues

A hub owner can use any reverse proxy as long as they don't set headers which can result in deployment issues. During deployment of PubHubs with Nginx we encountered an infinite redirect loop ([see more details](https://github.com/matrix-org/synapse/issues/10492)). Synapse documentation also provides an example of reverse proxy configuration with nginx; [see example](https://matrix-org.github.io/synapse/latest/reverse_proxy.html#reverse-proxy-configuration-examples). This example nginx configuration can be taken as an inspiration.

Hub and client already set headers which do not need to be explicitly set in nginx configuration. The following headers do not need to be set in the nginx configuration:

- X-Frame-Options
- Access-Control-Allow-Origin
- Content-Security-Policy

[&larr; Table of Content](../README.md)
