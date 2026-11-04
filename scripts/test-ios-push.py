#!/usr/bin/env python3
"""End-to-end test of iOS push notifications against a local test hub, on the Simulator or a device.

Walks the chain one link at a time, so a failure points at the broken link:

  hub         testhub<n> runs and got the constellation from PHC (so it knows the transcryptor)
  config      pubhubs/pubhubs.toml has APNs credentials for PHC ([phc.push.apns])
  credentials Apple accepts that key for that environment (no notification is sent)
  token       the app's pusher on the hub (from the Simulator's storage, or the hub's newest pusher)
  pusher      the pusher has a blob and points at the hub's current address
  gateway     a push to the hub's push gateway goes through the transcryptor and PHC to Apple
  e2e         a real message in a room makes Synapse push, and Apple accepts it
  foreground  with the app open, a push shows no banner but reaches JS as `pushReceived`
  tap         tapping the banner hands the push's tag to JS (interactive only)

For local test hubs only: the e2e step sends a real message as another user of the hub, using an
access token it reads from the hub's database. See docs/app/ios-push-test.md.
"""

import argparse
import base64
import datetime
import json
import re
import shlex
import signal
import subprocess
import sys
import time
import tomllib
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
HUB_DIR = REPO_ROOT / "pubhubs_hub"

BUNDLE_ID = "net.pubhubs.app"
APP_ID = "nl.pubhubs.client"
PHC_CONFIGS = [REPO_ROOT / "pubhubs" / "pubhubs.toml", REPO_ROOT / "pubhubs" / "pubhubs.default.toml"]
APNS_HOSTS = {"sandbox": "api.sandbox.push.apple.com", "production": "api.push.apple.com"}
SETTINGS_APP = "com.apple.Preferences"

# Runs inside the hub container, which has Synapse's yaml, sqlite3 and psycopg2: whatever database
# the hub uses, the queries below work unchanged (written with sqlite's `?` placeholders).
DB_QUERY = r"""
import json, sys, yaml
sql, params = sys.argv[1], json.loads(sys.argv[2])
db = yaml.safe_load(open('/data/homeserver.live.yaml'))['database']
if db['name'] == 'sqlite3':
    import sqlite3
    conn = sqlite3.connect('file:' + db['args']['database'] + '?mode=ro', uri=True)
else:
    import psycopg2
    conn = psycopg2.connect(**{k: v for k, v in db['args'].items()
                               if k in ('host', 'port', 'user', 'password', 'dbname', 'database')})
    sql = sql.replace('?', '%s')
cur = conn.cursor()
cur.execute(sql, params)
print(json.dumps([list(row) for row in cur.fetchall()], default=str))
"""

READ_YAML = r"""
import json, sys, yaml
print(json.dumps(yaml.safe_load(open(sys.argv[1]))))
"""


class Fail(Exception):
    pass


class Skip(Exception):
    pass


def run(*cmd, check=True, **kwargs):
    result = subprocess.run(cmd, capture_output=True, text=True, **kwargs)
    if check and result.returncode != 0:
        raise Fail(f"`{shlex.join(cmd)}` failed: {(result.stderr or result.stdout).strip()}")
    return result


class Context:
    """Everything the steps learn about the hub and the target, filled in as they go."""

    def __init__(self, args):
        self.args = args
        self.n = args.hub
        self.container = f"pubhubs-testhub{args.hub}"
        self.local_url = f"http://localhost:{8008 + args.hub}"
        self.hub_dir = HUB_DIR / f"testhub{args.hub}"
        self.out_dir = Path(args.out or f"/tmp/pubhubs-ios-push-test-{time.strftime('%Y%m%d-%H%M%S')}")
        self.interactive = sys.stdin.isatty() and not args.non_interactive
        self.simulator = args.target == "simulator"
        self.udid = None
        self.hub_id = None
        self.public_baseurl = None
        self.apns = None
        self.pushkey = args.pushkey
        self.tag = None  # the push's tag for this hub; only known on the Simulator
        self.pusher = None  # (user_id, data)
        self.line_open = False  # the runner printed a step's name and waits to print its result

    def close_line(self):
        if self.line_open:
            print()
            self.line_open = False

    def say(self, message):
        """Print a note while a step runs, below the step's name."""
        self.close_line()
        print(f"      {message}")

    # --- hub container ---

    def logs(self, since=None):
        cmd = ["docker", "logs"] + (["--since", str(since)] if since else []) + [self.container]
        result = run(*cmd, check=False)
        return result.stdout + result.stderr

    def query(self, sql, *params):
        result = run("docker", "exec", "-i", self.container, "python3", "-", sql, json.dumps(params),
                     input=DB_QUERY)
        return json.loads(result.stdout)

    def read_yaml(self, path):
        return json.loads(run("docker", "exec", "-i", self.container, "python3", "-", path, input=READ_YAML).stdout)

    def notify(self, event_id):
        """POST a notification to the hub's push gateway, as Synapse does for the pusher."""
        data = {k: v for k, v in self.pusher[1].items() if k != "url"}
        body = {"notification": {"event_id": event_id, "prio": "low", "devices": [
            {"app_id": APP_ID, "pushkey": self.pushkey, "pushkey_ts": 0, "data": data}]}}
        request = urllib.request.Request(f"{self.local_url}/_matrix/push/v1/notify", data=json.dumps(body).encode(),
                                         headers={"Content-Type": "application/json"}, method="POST")
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return response.status, response.read().decode()
        except urllib.error.HTTPError as e:
            return e.code, e.read().decode()

    def matrix(self, method, path, token, body=None):
        request = urllib.request.Request(f"{self.local_url}{path}", method=method,
                                         data=None if body is None else json.dumps(body).encode(),
                                         headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return response.status, json.loads(response.read() or b"{}")
        except urllib.error.HTTPError as e:
            return e.code, {}

    def gateway_answers(self, since, timeout=20):
        """Wait for Synapse to call the push gateway; return the status codes it got. 200 means PHC
        delivered the push (or that Apple rejected the token: then Synapse deletes the pusher)."""
        answered = re.compile(r'Processed request: .* (\d{3}) "POST /_matrix/push/v1/notify')
        deadline = time.time() + timeout
        while time.time() < deadline:
            codes = answered.findall(self.logs(since))
            if codes:
                return codes
            time.sleep(1)
        return []

    # --- target ---

    def ask(self, question):
        if not self.interactive:
            raise Skip("not checked (non-interactive)")
        self.close_line()
        try:
            answer = input(f"      {question} [y/N] ").strip().lower()
        except EOFError:
            raise Fail(f"no answer to: {question}")
        if answer not in ("y", "yes", "j", "ja"):
            raise Fail(f"answered no to: {question}")

    def wait_for_user(self, instruction):
        if self.interactive:
            self.close_line()
            try:
                input(f"      {instruction}, then press Enter ")
            except EOFError:
                raise Fail(f"no answer to: {instruction}")

    def to_background(self):
        if self.simulator:
            run("xcrun", "simctl", "launch", self.udid, SETTINGS_APP)
            time.sleep(4)  # a push arriving while the app is still on its way out goes the foreground path
        else:
            self.wait_for_user("Put PubHubs in the background on the device (e.g. lock it)")

    def screenshot(self, name):
        if not self.simulator:
            return None
        self.out_dir.mkdir(parents=True, exist_ok=True)
        path = self.out_dir / f"{name}.png"
        run("xcrun", "simctl", "io", self.udid, "screenshot", str(path))
        return path

    def check_banner(self, name):
        """Ask whether the banner appeared; non-interactively, only report where the screenshot is."""
        time.sleep(4)
        shot = self.screenshot(name)
        if not self.interactive:
            return f"banner not checked{f', see {shot}' if shot else ''}"
        self.say(f"expected: banner 'PubHubs / You have new messages' (or Dutch){f' - screenshot: {shot}' if shot else ''}")
        self.ask("Did the banner appear?")
        return "banner shown"


class SimConsole:
    """(Re)launches the app on the Simulator with its stdout captured, where Capacitor logs every
    event it hands to JS (`TO JS {...}`) in debug builds."""

    def __init__(self, ctx, name):
        ctx.out_dir.mkdir(parents=True, exist_ok=True)
        self.path = ctx.out_dir / f"{name}-console.log"
        self.ctx = ctx

    def __enter__(self):
        self.file = open(self.path, "w")
        self.process = subprocess.Popen(
            ("xcrun", "simctl", "launch", "--console-pty", "--terminate-running-process", self.ctx.udid, BUNDLE_ID),
            stdout=self.file, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL)
        time.sleep(self.ctx.args.app_load_wait)
        return self

    def to_foreground(self):
        """Make sure the captured app is still running and in front: right after a relaunch, the
        Simulator now and then leaves it behind the home screen."""
        if self.process.poll() is not None:
            raise Fail(f"the app quit while loading (see {self.path})")
        run("xcrun", "simctl", "launch", self.ctx.udid, BUNDLE_ID)  # only activates an app that runs already
        time.sleep(2)

    def received_push(self):
        log = self.path.read_text(errors="replace")
        # The plugin event as Capacitor logs it, or nativePush.ts's own log line.
        return f'"tag":"{self.ctx.tag}"' in log or f"push for hub {self.ctx.hub_id}" in log

    def __exit__(self, *exc):
        self.process.send_signal(signal.SIGINT)
        try:
            self.process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            self.process.kill()
        self.file.close()


# --- steps ---

def step_hub(ctx):
    if run("docker", "inspect", "-f", "{{.State.Running}}", ctx.container, check=False).stdout.strip() != "true":
        raise Fail(f"{ctx.container} isn't running: `mask run hub server {ctx.n}`")
    logs = ctx.logs()
    hub_ids = re.findall(r"resolved our hub id: (\S+)", logs)
    if not hub_ids:
        raise Fail("the hub hasn't got the constellation, so its push gateway doesn't know where to push. Is PHC running, "
                   "and was the hub started on the networkhost PHC uses (did your IP change)?")
    ctx.hub_id = hub_ids[-1]
    ctx.public_baseurl = ctx.read_yaml("/data/homeserver.live.yaml")["public_baseurl"].rstrip("/")
    return f"hub id {ctx.hub_id}, public_baseurl {ctx.public_baseurl}"


def step_config(ctx):
    path = next((p for p in PHC_CONFIGS if p.is_file()), None)
    if path is None:
        raise Fail("no PHC config found")
    apns = tomllib.loads(path.read_text()).get("phc", {}).get("push", {}).get("apns")
    if not apns:
        raise Fail(f"no [phc.push.apns] in {path}: copy pubhubs.default.toml to pubhubs/pubhubs.toml and add it "
                   "(see docs/app/ios-push-test.md), then restart PHC")
    missing = [key for key in ("key_id", "team_id", "private_key") if not apns.get(key)]
    if missing:
        raise Fail(f"[phc.push.apns] lacks {', '.join(missing)}")
    if apns.get("topic", BUNDLE_ID) != BUNDLE_ID:
        raise Fail(f"topic is {apns['topic']!r}, not {BUNDLE_ID!r} (Apple answers DeviceTokenNotForTopic)")
    platform = "sandbox" if apns.get("sandbox") else "production"
    ctx.out_dir.mkdir(parents=True, exist_ok=True)
    keyfile = ctx.out_dir / "apns-key.p8"
    keyfile.write_text(apns["private_key"])
    keyfile.chmod(0o600)
    ctx.apns = {"key_id": apns["key_id"], "team_id": apns["team_id"], "platform": platform, "keyfile": keyfile}
    note = "" if platform == "sandbox" else " - debug builds from Xcode get sandbox tokens: set sandbox = true"
    return f"{path.name}: key {apns['key_id']}, {platform}{note}"


def apns_jwt(keyfile, key_id, team_id):
    b64 = lambda data: base64.urlsafe_b64encode(data).rstrip(b"=").decode()
    signing_input = (b64(json.dumps({"alg": "ES256", "kid": key_id}).encode()) + "."
                     + b64(json.dumps({"iss": team_id, "iat": int(time.time())}).encode()))
    der = subprocess.run(("openssl", "dgst", "-sha256", "-sign", str(keyfile)), input=signing_input.encode(),
                         capture_output=True, check=True).stdout
    # DER ECDSA-Sig-Value { r INTEGER, s INTEGER } -> JWS's raw 32-byte r || s
    r_len = der[3]
    r = der[4:4 + r_len]
    s = der[4 + r_len + 2:]
    return signing_input + "." + b64(r[-32:].rjust(32, b"\0") + s[-32:].rjust(32, b"\0"))


def step_credentials(ctx):
    # An all-zero device token: with a valid key Apple answers 400 BadDeviceToken, with a bad one
    # 403 - either way nothing is delivered anywhere.
    jwt = apns_jwt(ctx.apns["keyfile"], ctx.apns["key_id"], ctx.apns["team_id"])
    result = run("curl", "-s", "--http2", "-w", "\n%{http_code}", "-H", f"authorization: bearer {jwt}",
                 "-H", f"apns-topic: {BUNDLE_ID}", "-H", "apns-push-type: alert", "-d", '{"aps":{}}',
                 f"https://{APNS_HOSTS[ctx.apns['platform']]}/3/device/{'0' * 64}")
    body, _, status = result.stdout.rpartition("\n")
    reason = json.loads(body).get("reason") if body.strip() else None
    if status == "400" and reason == "BadDeviceToken":
        return f"Apple accepts key {ctx.apns['key_id']} for {ctx.apns['platform']}"
    hints = {"BadEnvironmentKeyInToken": f"this key isn't enabled for {ctx.apns['platform']} (keys can be limited "
                                         "to sandbox or production)",
             "InvalidProviderToken": "wrong key_id/team_id for this key, or a revoked key"}
    raise Fail(f"Apple answered {status} {reason}" + (f": {hints[reason]}" if reason in hints else ""))


def simulator_storage(udid, key):
    """The app's localStorage values for `key` on the Simulator `udid`, parsed as JSON."""
    devices = Path.home() / "Library/Developer/CoreSimulator/Devices"
    pattern = f"{udid}/data/Containers/Data/Application/*/Library/WebKit/{BUNDLE_ID}/WebsiteData/**/localstorage.sqlite3"
    values = []
    for db in devices.glob(pattern):
        result = run("sqlite3", "-readonly", str(db), f"select hex(value) from ItemTable where key='{key}';", check=False)
        for value in result.stdout.split():
            try:
                values.append(json.loads(bytes.fromhex(value).decode("utf-16-le")))
            except ValueError:
                continue
    return values


def step_token(ctx):
    if ctx.simulator:
        booted = [d for devices in json.loads(run("xcrun", "simctl", "list", "devices", "booted", "-j").stdout)["devices"].values()
                  for d in devices]
        if ctx.args.udid:
            booted = [d for d in booted if d["udid"] == ctx.args.udid]
        if len(booted) != 1:
            raise Fail("no booted Simulator" if not booted else
                       "several Simulators booted, pick one with --udid: " + ", ".join(d["udid"] for d in booted))
        ctx.udid = booted[0]["udid"]
        if run("xcrun", "simctl", "get_app_container", ctx.udid, BUNDLE_ID, check=False).returncode != 0:
            raise Fail(f"{BUNDLE_ID} isn't installed on {booted[0]['name']}: `npm run cap:run:ios`")
        devices = [d for d in simulator_storage(ctx.udid, "nativePushDevice") if d and d.get("transport") == "apns"]
        if not devices:
            raise Fail("the app has no APNs token yet: open it and allow notifications")
        pushers = [p[ctx.hub_id] for p in simulator_storage(ctx.udid, "nativePushPushers") if p and ctx.hub_id in p]
        if not pushers:
            raise Fail(f"the app has no pusher on testhub{ctx.n}: log in to the hub in the app")
        ctx.pushkey = ctx.pushkey or pushers[0]["pushkey"]
        ctx.tag = pushers[0]["tag"]
        return f"{booted[0]['name']} ({ctx.udid}), token {devices[0]['token'][:16]}…, pushkey {ctx.pushkey[:8]}…"

    if ctx.pushkey:
        return f"pushkey {ctx.pushkey[:8]}… (--pushkey)"
    # The hub can't tell iOS from Android, or one device from another: that's the point.
    pushers = ctx.query("select pushkey, ts, data from pushers where app_id = ? order by ts desc", APP_ID)
    if not pushers:
        raise Fail(f"no pusher on testhub{ctx.n}: log in to it in the app on the device")
    ctx.pushkey = pushers[0][0]
    others = f" ({len(pushers) - 1} other pusher(s); use --pushkey to pick)" if len(pushers) > 1 else ""
    return f"newest pusher, pushkey {ctx.pushkey[:8]}…{others}"


def step_pusher(ctx):
    rows = ctx.query("select user_name, data, enabled from pushers where app_id = ? and pushkey = ?", APP_ID, ctx.pushkey)
    if not rows:
        raise Fail(f"no pusher with this pushkey on testhub{ctx.n}: log in to the hub in the app")
    user, data, enabled = rows[0]
    data = json.loads(data)
    ctx.pusher = (user, data)
    if enabled in (False, 0):
        raise Fail(f"the pusher of {user} is disabled")
    expected = f"{ctx.public_baseurl}/_matrix/push/v1/notify"
    if data.get("url") != expected:
        raise Fail(f"the pusher points at {data.get('url')}, but the hub now runs at {expected}: "
                   "relaunch the app so it registers again")
    if data.get("format") != "event_id_only":
        raise Fail(f"pusher format is {data.get('format')!r}, not 'event_id_only'")
    if not data.get("blob"):
        raise Fail("the pusher has no blob: it's from an older app build; relaunch the app")
    return f"{user} -> {data['url']}"


def check_gateway_answer(status, body):
    """The push gateway answers 200 once PHC delivered the push, and lists the pushkey as rejected
    when Apple (or PHC) refused it for good."""
    if status != 200:
        raise Fail(f"push gateway answered {status}: {body.strip()[:200]} (is the transcryptor running, and PHC "
                   "configured? See PHC's log)")
    if json.loads(body).get("rejected"):
        raise Fail("the push was rejected: Apple refused the token (a sandbox token on production, or "
                   "the other way round, or the app was reinstalled), or PHC couldn't read the blob")


def step_gateway(ctx):
    ctx.to_background()
    event_id = f"$ios-push-test-gateway-{int(time.time())}"
    check_gateway_answer(*ctx.notify(event_id))
    return f"Apple accepted it; {ctx.check_banner('gateway')}"


def find_sender(ctx, user):
    """Another local user, with a valid access token, in a room `user` is joined to - smallest room first."""
    now = int(time.time() * 1000)
    candidates = ctx.query(
        "select o.room_id, o.user_id, (select count(*) from local_current_membership x"
        "   where x.room_id = o.room_id and x.membership = 'join') as members"
        " from local_current_membership m"
        " join local_current_membership o on o.room_id = m.room_id and o.membership = 'join' and o.user_id != m.user_id"
        " where m.user_id = ? and m.membership = 'join'"
        " order by members, o.user_id", user)
    for room_id, sender, _ in candidates:
        if ctx.args.room and room_id != ctx.args.room:
            continue
        tokens = ctx.query("select token from access_tokens where user_id = ?"
                           " and (valid_until_ms is null or valid_until_ms > ?) order by id desc limit 1", sender, now)
        if tokens and ctx.matrix("GET", "/_matrix/client/v3/account/whoami", tokens[0][0])[0] == 200:
            return room_id, sender, tokens[0][0]
    return None


def step_e2e(ctx):
    user, data = ctx.pusher
    if ctx.args.sender_token:
        if not ctx.args.room:
            raise Fail("--sender-token needs --room")
        room_id, sender, token = ctx.args.room, "--sender-token", ctx.args.sender_token
    else:
        found = find_sender(ctx, user)
        if not found:
            raise Skip(f"no other local user with a valid token shares a room with {user}; "
                       "pass --sender-token and --room")
        room_id, sender, token = found
    ctx.to_background()
    since = int(time.time()) - 1
    txn = f"ios-push-test-{int(time.time() * 1000)}"
    status, response = ctx.matrix("PUT", f"/_matrix/client/v3/rooms/{urllib.parse.quote(room_id)}/send/m.room.message/{txn}",
                                  token, {"msgtype": "m.text", "body": f"iOS push test {datetime.datetime.now():%H:%M:%S}"})
    if status != 200:
        raise Fail(f"sending as {sender} in {room_id} failed: {status}")
    codes = ctx.gateway_answers(since)
    if not codes:
        failed = re.search(r"Failed to push data to " + re.escape(f"{user}/{APP_ID}/{ctx.pushkey}") + r": (.*)",
                           ctx.logs(since))
        raise Fail(f"Synapse couldn't reach the push gateway: {failed.group(1)}" if failed else
                   f"Synapse didn't push for {response['event_id']}: is the room muted, or are push rules off for {user}?")
    if codes[-1] != "200":
        problem = re.findall(r"push gateway: (.*)", ctx.logs(since))
        raise Fail(f"the push gateway answered {codes[-1]}" + (f": {problem[-1]}" if problem else ""))
    return f"{sender} wrote in {room_id}, the push went through; {ctx.check_banner('e2e')}"


def step_foreground(ctx):
    if ctx.simulator:
        with SimConsole(ctx, "foreground") as console:
            console.to_foreground()
            check_gateway_answer(*ctx.notify(f"$ios-push-test-foreground-{int(time.time())}"))
            time.sleep(4)
            ctx.screenshot("foreground")
            if not console.received_push():
                raise Fail(f"JS never got the push with tag {ctx.tag} (see {console.path})")
        return f"JS got the push for hub {ctx.hub_id}; screenshot should show no banner"
    if not ctx.interactive:
        raise Skip("needs someone watching the device")
    ctx.wait_for_user("Open PubHubs on the device and keep it in the foreground")
    check_gateway_answer(*ctx.notify(f"$ios-push-test-foreground-{int(time.time())}"))
    ctx.ask(f"No banner, and the app switched to testhub{ctx.n}?")
    return "no banner, app went to the hub"


def step_tap(ctx):
    if not ctx.interactive:
        raise Skip("needs someone to tap the banner")

    def push_and_tap():
        ctx.to_background()
        check_gateway_answer(*ctx.notify(f"$ios-push-test-tap-{int(time.time())}"))
        ctx.wait_for_user("Tap the banner")
        time.sleep(3)

    if ctx.simulator:
        with SimConsole(ctx, "tap") as console:
            push_and_tap()
            if not console.received_push():
                raise Fail(f"JS never got the push with tag {ctx.tag} (see {console.path})")
    else:
        push_and_tap()
    ctx.ask(f"Did PubHubs open, on testhub{ctx.n}?")
    return "tap opened the hub"


STEPS = [
    # (name, step, later steps need it)
    ("hub", step_hub, True),
    ("config", step_config, True),
    ("credentials", step_credentials, True),
    ("token", step_token, True),
    ("pusher", step_pusher, True),
    ("gateway", step_gateway, False),
    ("e2e", step_e2e, False),
    ("foreground", step_foreground, False),
    ("tap", step_tap, False),
]


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("hub", type=int, nargs="?", default=0, help="test hub number (default 0)")
    parser.add_argument("--target", choices=("simulator", "device"), default="simulator")
    parser.add_argument("--udid", help="Simulator to use when several are booted")
    parser.add_argument("--pushkey", help="pushkey of the hub's pusher to push to, instead of looking it up")
    parser.add_argument("--room", help="room for the e2e message (default: the smallest shared room)")
    parser.add_argument("--sender-token", help="access token to send the e2e message with (needs --room)")
    parser.add_argument("--only", help="comma-separated steps to run (plus the ones they depend on)")
    parser.add_argument("--non-interactive", action="store_true", help="never prompt; skips visual checks and tap")
    parser.add_argument("--app-load-wait", type=int, default=15, help="seconds the app gets to load after a relaunch")
    parser.add_argument("--out", help="directory for screenshots and console logs")
    args = parser.parse_args()

    names = [name for name, _, _ in STEPS]
    only = set(args.only.split(",")) if args.only else set(names)
    if only - set(names):
        parser.error(f"unknown step(s) {', '.join(sorted(only - set(names)))}; steps are {', '.join(names)}")

    ctx = Context(args)
    print(f"iOS push test: testhub{args.hub}, target {args.target}"
          + ("" if ctx.interactive else ", non-interactive"))
    results = []
    for name, step, required in STEPS:
        if not required and name not in only:
            continue
        print(f"  {name:<12}", end="", flush=True)
        ctx.line_open = True

        def report(result, message):
            print(("" if ctx.line_open else f"  {'':<12}") + f"{result}  {message}")
            results.append(result)

        try:
            report("PASS", step(ctx))
        except Skip as e:
            report("SKIP", e)
        except Fail as e:
            report("FAIL", e)
            if required:
                print("  stopping: the remaining steps depend on this one")
                break
        except KeyboardInterrupt:
            print("interrupted")
            sys.exit(130)
    if ctx.out_dir.exists():
        print(f"screenshots and logs: {ctx.out_dir}")
    print(f"{results.count('PASS')} passed, {results.count('FAIL')} failed, {results.count('SKIP')} skipped")
    sys.exit(1 if "FAIL" in results else 0)


if __name__ == "__main__":
    main()
