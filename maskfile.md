# PubHubs commands for local development

Run these with the following command: `mask run [command name]` (ex. `mask run global`).

Make sure you have [mask](https://github.com/jacobdeichert/mask) installed (it is already included in the Nix flake).
Make sure you have [irma](https://github.com/privacybydesign/irmago) installed

## run

> Commands for running the development environment

### yivi

> Runs the Yivi server for the PubHubs servers

```sh
cd pubhubs
echo "Running Yivi server..."
./yivi.sh
```

```powershell
cd pubhubs
echo "Running Yivi server..."
./yivi.sh
```

### servers

> Runs the global PubHubs servers

```sh
cd pubhubs
echo "Running global servers..."
cargo run serve
```

```powershell
cd pubhubs
echo "Running global servers..."
cargo run serve
```

### client

> Runs the pubhubs global client

```sh
cd global-client
echo "Running pubhubs client..."
npx vite --host -l info --port=8080
```

```powershell
cd global-client
echo "Running pubhubs client..."
npx vite --host -l info --port=8080
```

### hub

> Commands for running the hub

Every command below is structured as `mask run hub <subcommand>`

#### server (n)

> Runs the n-th hub server

Don't forget to build the hub image and setup the hub's directory using the
`mask run hub init` command before running the server and client command

```sh
cd pubhubs_hub
echo "Running testhub${n}"
./start_testhub.py "${n}"
```

```powershell
cd pubhubs_hub
echo "Running testhub${n}"
./start_testhub.py "${n}"
```

#### client (n)

> Runs the n-th hub client

Don't forget to build the hub image and setup the hub's directory using the
`mask run hub init` command before running the server and client command

```sh
cd hub-client
echo "Running Hub client for testhub${n}..."
env VITE_HUB_URL=$(node -e "console.log('http://localhost:' + (8008 + $n))") npx vite --host -l info --port=$(node -e "console.log(8001 + $n)")
```

```powershell
cd hub-client
$hubPort = 8008 + $n
$vitePort = 8001 + $n
$env:VITE_HUB_URL = "http://localhost:$hubPort"
echo "Running Hub client for testhub$n..."
echo "Using VITE_HUB_URL=$($env:VITE_HUB_URL) and Vite port $vitePort"
npx vite --host -l info --port=$vitePort
```

#### init

> Initialize test setup


```sh
mask run hub init testhub-dirs
mask run hub init testhub-image
```

```powershell
mask run hub init testhub-dirs
mask run hub init testhub-image
```

##### testhub-dirs

> Prepares directories for running the local hubs

This command is normally run via the `mask run hub init` command

```sh
echo "Setting up testhub directories..."
cd pubhubs_hub
for i in $(seq 0 4);
do
    echo "testhub$i"
    rm -rf "testhub${i}"
    cp -r matrix_test_config "testhub$i"
    chmod 777 "testhub$i"
done
```

```powershell
echo "Setting up testhub directories..."
cd pubhubs_hub
For ($i=0; $i -le 4; $i++) {
    echo "testhub$i"
    Remove-Item -Recurse -Force "testhub${i}"
    cp -r matrix_test_config "testhub$i"
}
```

##### testhub-image

> Build the PubHubs hub Docker image

This command is normally run via the `mask run hub init` command

```sh
echo  "Building hub..."
cd pubhubs_hub
docker build -t pubhubs-hub .
```

```powershell
echo  "Building hub..."
cd pubhubs_hub
docker build -t pubhubs-hub .
```
