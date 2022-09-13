# Pubhubs Hub

Extensions to the Matrix homeserver (synapse) to make it work with PubHubs:

- modules
- templates
- (test) config


## Testing

In the root directory run:

`python3 ./test/pseudonyms_test.py`



## Development dependencies

We use libpepcli to make pseudonyms. Please install it on your system. For debian based systems the command is:
```bash
sh -c 'printf "deb http://packages.bitpowder.com/debian-%s main core\n" `lsb_release -cs`' | tee /etc/apt/sources.list.d/bitpowder-repo.list
curl -L https://bitpowder.com/packages/linux-packages.gpg | tee /etc/apt/trusted.gpg.d/bitpowder.asc

apt-get update && apt-get install -y pepcli
```

For macOS use: 

```bash
brew tap ilab/libpep https://gitlab.science.ru.nl/ilab/libpep
brew install --HEAD ilab/libpep/libpep
```

For other systems see the instructions here: https://gitlab.science.ru.nl/ilab/libpep
