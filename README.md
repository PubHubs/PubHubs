# PubHubs — Public hubs for community networks

PubHubs (Public Hubs) is a Dutch community network platform built on public values: openness, transparency and collective stewardship. It connects people across local hubs (i.e. neighbourhoods, sports clubs, schools, museums, patient organisations, libraries, municipalities) while protecting participants’ data and enabling trustworthy communication.

---

## Contact & quick links

- Website / info: https://pubhubs.net/en/
- Development dependencies / reproducible dev environment: flake.nix
- Docs: docs/README.md and doc/
- If you want to get involved or test: please contact the team via the website.

---

# Current status

This project is **in active development** and moving through test phases. The repository is a mirror of internal work and may be subject to major changes before a stable release. If you or your organisation want to help test or contribute, contact the team first.

---

## Architecture

- **PubHubs central** — Central authentication and identity management (issues pseudonyms to hubs). Implemented in Rust.
- **Global client** — Web client that navigates between hubs (embeds hub clients via iframe). Implemented in TypeScript + Vue.
- **Hub servers** — Customised Matrix homeservers (based on Synapse) extended with PubHubs Python modules; by default hubs are not federated inside PubHubs.
- **Hub clients** — Matrix-based clients embedded in the Global Client with PubHubs-specific features (secured rooms, attribute-based access). Implemented in TypeScript + Vue.
- **Identity / attributes** — Handled by [Yivi](https://yivi.app) (used for login and attribute-based access).

---

### Important files & directories

| Path / Name           |   Type | Purpose                                                            | Notes                                              |
| --------------------- | -----: | ------------------------------------------------------------------ | -------------------------------------------------- |
| `flake.nix`           |   file | Nix flake with reproducible developer environment and dependencies | Use this to create dev shells.                     |
| `docker_yivi/`        |    dir | Docker build files for the Yivi image                              | Builds the Yivi server used for identity features. |
| `global-client/`      |    dir | Global client source (TypeScript + Vue)                            | Embeds hub clients via iframe.                     |
| `hub-client/`         |    dir | Hub client source (TypeScript + Vue)                               | Matrix client customisations.                      |
| `pubhubs/`            |    dir | PubHubs Central (Rust)                                             | Central login & identity platform.                 |
| `pubhubs_hub/`        |    dir | Hub server build / Synapse extensions (Python)                     | Matrix server modules & hub configuration.         |

> [!Warning] Placement note
> Do not place this repository inside a folder managed by home-manager’s impermanence feature — that can cause permission problems for test hub data and local services.

---

## Developer quickstart

### 1. Reproducible development shell using `Nix flake`

Use the flake to start a reproducible dev shell:

```sh
nix develop
# Or, with direnv enabled:
direnv allow
```

See flake.nix for the exact packages and toolchain the project uses.

### 2. Shell helper using `Mask`

[Mask](https://github.com/jacobdeichert/mask) is included in the flake, but you can also install it globally.

```sh
# Run a task defined in maskfile.md
mask <task> # e.g. `mask run yivi`
```

See the [Maskfile](./maskfike.md) for all available commands.

### 3. Yivi

To log into the local development, the Yivi app must be set to developer-mode. This can be done by clicking the App ID in the overflow menu a couple of times.

---

## Further documentation & changelog

- Main docs: [README.md](./README.md)
- Changelog: [CHANGELOG.md](./CHANGELOG.md)
