<img src="docs/images/pubhubs-logo.svg" width="64" alt="" />

# PubHubs

**Public hubs for community networks.**

One login for all your communities. What you say in one stays there. PubHubs is a European community
network built on public values: openness, transparency and collective stewardship. It is used by
hubs in the Netherlands, and still in active development. See [Getting started](#1-getting-started).

<br/>

[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue?style=flat-square)](LICENSE)

You probably belong to several communities: a sports club, a patient association, a neighbourhood
group. Online, each lives on a platform that wants your attention, shows you ads, and knows who you
are everywhere.

On PubHubs, every community has its own **hub**, run by the organisation itself: a neighbourhood
association, a school, a museum, a library, a municipality. You log in once, and move between hubs
with a click. In each hub you are someone else: a random name unless you choose one, and nothing
ties you to who you are in another hub. Where it matters, a room can ask you to prove something
about yourself, such as that you live in the neighbourhood, so you know who you are talking to.

<br/>

## 1 Getting started

1. **Install [Yivi](https://yivi.app)** on your phone. It is the app you log in with. Add your email
   address and phone number to it; Yivi checks them.
2. **Open [app.pubhubs.net](https://app.pubhubs.net)** and choose **Register**. Scan the QR code
   with Yivi and share your email address and phone number. You get a PubHubs card in Yivi, which
   you log in with from then on. In the PubHubs app, Yivi opens on the same phone instead.
3. **Find your hubs.** The compass shows every hub. Enter one, look around, and join its rooms.
4. **On your phone**, add PubHubs to your home screen from the browser, to open it like an app.

**The PubHubs app.** An app for Android is on its way: to Google Play and F-Droid, and as an APK on
our [GitHub releases](https://github.com/PubHubs/PubHubs/releases). An app for iPhone follows
later. The app works like the website, and also opens hubs you already know when there's no
connection.

The [help pages](https://www.pubhubs.net/en/help/) explain the rest, also for hub admins and
moderators.

<br/>

## 2 Privacy and safety

- **Hubs don't know who you are.** Your email address and phone number are only used to log in; no
  hub sees them. Each hub knows you by its own pseudonym, such as `04a-d83`, until you pick a name.
- **Nobody can link your hubs.** PubHubs Central doesn't learn which hubs you enter, and your
  pseudonyms in two hubs can't be linked, not even by the hubs together.
- **Secured rooms** ask you to disclose something with Yivi, such as your email domain or age,
  before you join. Everyone in the room has disclosed the same, so you know who you are talking to.
- **No ads, no feed.** There is no central timeline and no algorithm deciding what you see.
- **Stays in the hub.** Hubs are not federated: what is said in a hub stays on that hub's server.

The code is open, and the cryptography behind the pseudonyms is published in
[a paper](https://academic.oup.com/logcom/article/34/7/1377/7319213). Found a security problem? See
the [security policy](SECURITY.md).

<br/>

## Table of contents

- [3 Documentation](#3-documentation)
- [4 What you can do](#4-what-you-can-do)
- [5 Questions or issues?](#5-questions-or-issues)
- [6 License](#6-license)

<br/>

## 3 Documentation

If you want to run a hub, work on PubHubs, or build something on top of it:

- [**Running a hub**](docs/running-a-hub.md) - Hosting a hub server and client, the reverse proxy,
  video calls, admins and updates.
  [Contact the PubHubs team](https://www.pubhubs.net/en/help/contact/) first, so your hub can be
  added to PubHubs.
- [**Development**](docs/development.md) - Setup, running everything on your own computer, logging
  in with Yivi, checks and tests. Start here to work on PubHubs.
- [**Architecture**](docs/architecture.md) - The components, how logging in and entering a hub work,
  and how the code is laid out.
- [**Hub API**](docs/hub-api.md) - The endpoints the PubHubs modules add to a hub.
- [**Hub client**](docs/hub-client.md) - Where things are in the hub client: stores, styling, icons
  and languages.
- [**Video calls**](docs/video-calls.md) - How a call works, and how to debug one.
- [**The app**](docs/app/README.md) - The Android and iOS app: building and releasing it, review mode
  for the app stores, what hubs need for it, and how it keeps hubs apart and works offline.
- [**Coding guidelines**](docs/coding-guidelines.md) and
  [**security guidelines**](docs/security-guidelines.md) - How we write the code, and the security
  mistakes to avoid.

Changes are in [CHANGELOG.md](CHANGELOG.md).

<br/>

## 4 What you can do

### 4.1 Hubs

The compass shows every hub, with what it is about. The hubs you use are in the sidebar, with the
number of new messages. In each hub you choose your own name and photo, or none at all.

### 4.2 Rooms

- **Public rooms** are open to everyone in the hub.
- **Secured rooms**, marked with a shield, ask you to disclose something with Yivi first. You only
  share what the room asks for: if it needs you to be over 18, it doesn't learn your date of birth.
- **Forum rooms** hold posts with their own discussions, instead of one stream of messages.
- **Direct messages** are private conversations with one or more members.

### 4.3 Messages

Reply in threads, react, share files and images, and find them back in a room's library or with
search. **Polls** and **schedulers** help a group decide or find a date. A **signed message** shows
what you disclosed with Yivi, such as your profession, for statements that need it.

### 4.4 Video calls

Start a call from a room, and others in the room join from the message it posts. Share your screen
once others have joined.

### 4.5 Moderation

Rooms can have moderators. Members can report a message to them, and moderators can post
announcements, whisper to a member privately, or give a yellow card (kick) or a red card (ban). Hub
admins set up the hub, its rooms and who moderates them.

### 4.6 Your way

PubHubs is in English and Dutch, in light or dark mode or following your system, and works on your
phone as well as on your computer.

<br/>

## 5 Questions or issues?

For help with using PubHubs, see the [help pages](https://www.pubhubs.net/en/help/) or
[contact the team](https://www.pubhubs.net/en/help/contact/). Found a bug, or have an idea? Please
[open an issue](https://github.com/PubHubs/PubHubs/issues) on GitHub. Security problems go
privately, as described in the [security policy](SECURITY.md).

The main repository is on
[Radboud University's GitLab](https://gitlab.science.ru.nl/ilab/pubhubs_canonical), and is mirrored
to [GitHub](https://github.com/PubHubs/PubHubs).

<br/>

## 6 License

Licensed under the [Apache License 2.0](LICENSE). Bundled fonts and libraries, and their licences,
are listed at the end of the license file.
