# Deployment guide for PubHubs

## Introduction

<img src=pictures/logo.png alt="drawing" width="100"/> is a decentralized community-based platform for people to communicate in a secure and privacy-friendly manner. We provide guide to setup and deploy Pubhubs in an organization's infrastructure.<mark> Communication between client and hubs are done in a secure manner. Therefore, HTTPS communication protocol is required <mark>. We currently do not support federation of Matrix server.

There are different components of Pubhubs such as Central Platform, Hub and a client. Each of these have different deployment configuration and settings. Information about each settings are provided in their corresponding directory.

Central Platform is currently hosted at iHub, Radboud University. Therefore, the configuration settings of Hub and client are important for deploying PubHubs in your organization. However, we provide information about setting up central platform for future migration of Central Platform and also for learning purpose.

> In this documentation we are using specific port numbers but these are only for demonstration purpose. The port numbers are to be changed based on configuration requirements.

[Hub Instructions (Hub Administrators) &rarr;](./deploy/hub/README.md)
[Central Platform Instructions (Central Administrator only)  &rarr;](./deploy/central_platform/README.md)