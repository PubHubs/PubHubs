# Registering a hub

Hub owners ask for this with the "Register a hub" issue form on our [GitHub mirror](https://github.com/PubHubs/PubHubs/issues) (or by email). Link their request here.

- [ ] Check the details: the handle is lower-case letters, digits and underscores and not taken yet, and the domains follow [Running a hub](docs/running-a-hub.md#what-you-need).
- [ ] In the `pubhubs` directory, generate an `id` with `cargo run tools generate id`.
- [ ] Add the hub to the `pubhubs.toml` of PubHubs Central as in [Registering the hub](docs/running-a-hub.md#registering-the-hub). For https://app.pubhubs.net that is `/data/phmss-stable/config/pubhubs.toml` on the PubHubs VM (see [the wiki](https://gitlab.science.ru.nl/ilab/pubhubs_canonical/-/wikis/Infrastructure)). Never change the `id` or remove a handle afterwards.
- [ ] Restart PubHubs Central: `systemctl restart docker-phmss-stable`.
- [ ] Send the hub owner a deploy token.
- [ ] Add the hub to the [external hubs](https://gitlab.science.ru.nl/ilab/pubhubs_canonical/-/wikis/Tech-Information/External-Hub-Deployment).
- [ ] Once the hub runs, check that it shows on https://app.pubhubs.net and that you can enter it.
- [ ] Reply to the request and close it.
