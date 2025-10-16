# PubHubs commands for local development

Run these with the following command: `mask run [command name]` (ex. `mask run global`).

Make sure you have [mask](https://github.com/jacobdeichert/mask) installed (it is already included in the Nix flake).
Make sure you have [irma](https://github.com/privacybydesign/irmago) installed

## run

> Commands for running the development environment

### all

> Run all

```sh
bash run-all.sh
```

### init

> Initializes/wipes the development environment
```sh
mask run s3 init
mask run hub init
```

### yivi

> Runs the Yivi server for the PubHubs servers

```sh
cd pubhubs
echo "Running Yivi server..."
bash yivi.sh
```

```powershell
cd pubhubs
echo "Running Yivi server..."
bash yivi.sh
```

### s3

> Runs the Garage S3 server for the PubHubs PHC server

```sh
cd pubhubs
python3 run_garage.py
```

#### init

`> Intializes/wipes the garage storage directory

```sh
set -e
cd pubhubs
echo "removing garage data and meta directories..."
rm -rf garage/data
rm -rf garage/meta
echo "creating garage data and meta directories..."
mkdir garage/data
mkdir garage/meta
echo "starting garage for configuration..."

trap 'echo "removing garage container" && docker rm -f pubhubs-garage' EXIT INT

python3 run_garage.py --detach

# from this point onwards, we're not using any paths on the host, so we can safely
# disable windows path conversion (that would convert "/garage" to "C:/...")
export MSYS_NO_PATHCONV=1

echo "waiting for garage to initialize..."
while ! docker exec pubhubs-garage /garage status; do 
  sleep .5
done

# based on https://garagehq.deuxfleurs.fr/documentation/quick-start/

echo "getting node id..."
NODE_ID="$(docker exec pubhubs-garage /garage node id)"

echo "assigning and applying layout..."
docker exec pubhubs-garage /garage layout assign -z dc1 -c 1G "$NODE_ID"
docker exec pubhubs-garage /garage layout apply --version 1

echo "creating bucket..."
docker exec pubhubs-garage /garage bucket create phc

echo "creating key..."
docker exec pubhubs-garage /garage key import --yes -n phc GK4ab65ecd61df5cd9382075c5 c46af3789d8f98b527538e4eeea6c1130e1356b694f391fa6f9af5098121e50f

echo "adding key to bucket..."
docker exec pubhubs-garage /garage bucket allow --read --write phc --key phc

echo "\033[1;32mfinished setting up garage\033[0m"
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
python3 start_testhub.py "${n}"
```

```powershell
cd pubhubs_hub
echo "Running testhub${n}"
python3 start_testhub.py "${n}"
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

> Initialize testhubs setup


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
