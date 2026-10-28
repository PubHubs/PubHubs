#!/usr/bin/env python3
"""End-to-end test of iOS push notifications against a local test hub, on the Simulator or a device.

Walks the chain one link at a time, so a failure points at the broken link:

  hub         testhub<n> runs, Sygnal is up and the hub resolved its hub id from PHC
  config      the hub's sygnal.yaml has a sane `nl.pubhubs.client.ios` app
  credentials Apple accepts the .p8 key for that environment (no notification is sent)
  token       the APNs device token of the target (read from the Simulator, or the hub's pushers)
  pusher      the hub has a pusher for that token, pointing at the hub's current address
  gateway     a push straight to the hub's push gateway reaches Apple and shows the banner
  e2e         a real message in a room makes Synapse push, and shows the banner
  foreground  with the app open, a push shows no banner but reaches JS as `pushReceived`
  tap         tapping the banner hands the hub id to JS (interactive only)

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
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
HUB_DIR = REPO_ROOT / "pubhubs_hub"

BUNDLE_ID = "net.pubhubs.app"
APP_ID = "nl.pubhubs.client.ios"
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
        """POST a notification to the hub's push gateway, shaped like Synapse's for an event_id_only pusher."""
        body = {"notification": {"event_id": event_id, "prio": "low", "devices": [
            {"app_id": APP_ID, "pushkey": self.pushkey, "pushkey_ts": 0, "data": {"format": "event_id_only"}}]}}
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

    def sygnal_dispatch(self, event_id, since, timeout=20):
        """Wait for Sygnal to send `event_id` to Apple; return the log lines of that request."""
        sending = re.compile(r"\[([0-9a-f-]{36})\] Sending \(attempt \d+\) => .* event:" + re.escape(event_id) + r"\b")
        deadline = time.time() + timeout
        while time.time() < deadline:
            logs = self.logs(since)
            match = sending.search(logs)
            if match:
                time.sleep(1)  # let Sygnal log Apple's answer too
                return [line for line in self.logs(since).splitlines() if f"[{match.group(1)}]" in line]
            time.sleep(1)
        return None

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

    def received_hub_id(self):
        return f'"hub_id":"{self.ctx.hub_id}"' in self.path.read_text(errors="replace")

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
    if "No /data/sygnal.yaml found" in logs:
        raise Fail(f"Sygnal is off: copy pubhubs_hub/config/local/sygnal.local.yaml to {ctx.hub_dir}/sygnal.yaml, "
                   "fill it in and restart the hub")
    if "SygnalLoggedSite starting" not in logs:
        raise Fail("Sygnal didn't start; check the hub's log")
    hub_ids = re.findall(r"resolved our hub id: (\S+)", logs)
    if not hub_ids:
        raise Fail("the hub hasn't resolved its hub id, so its push gateway refuses every push. Is PHC running, "
                   "and was the hub started on the networkhost PHC uses (did your IP change)?")
    ctx.hub_id = hub_ids[-1]
    ctx.public_baseurl = ctx.read_yaml("/data/homeserver.live.yaml")["public_baseurl"].rstrip("/")
    return f"hub id {ctx.hub_id}, public_baseurl {ctx.public_baseurl}"


def step_config(ctx):
    app = ctx.read_yaml("/data/sygnal.yaml").get("apps", {}).get(APP_ID)
    if not app:
        raise Fail(f"no `{APP_ID}` app in {ctx.hub_dir}/sygnal.yaml")
    problems = []
    if app.get("type") != "apns":
        problems.append(f"type is {app.get('type')!r}, not 'apns'")
    if app.get("topic") != BUNDLE_ID:
        problems.append(f"topic is {app.get('topic')!r}, not {BUNDLE_ID!r} (Apple answers DeviceTokenNotForTopic)")
    if app.get("convert_device_token_to_hex", True) is not False:
        problems.append("convert_device_token_to_hex must be false: the app sends hex tokens, not base64")
    for key in ("keyfile", "key_id", "team_id"):
        if not app.get(key):
            problems.append(f"{key} is missing")
    platform = app.get("platform", "production")
    if platform not in APNS_HOSTS:
        problems.append(f"platform is {platform!r}")
    if problems:
        raise Fail("; ".join(problems))
    keyfile = app["keyfile"]
    if not keyfile.startswith("/data/"):
        raise Fail(f"keyfile {keyfile} isn't under /data, so this suite can't find it on the host")
    ctx.apns = {"key_id": app["key_id"], "team_id": app["team_id"], "platform": platform,
                "keyfile": ctx.hub_dir / keyfile.removeprefix("/data/")}
    if not ctx.apns["keyfile"].is_file():
        raise Fail(f"{ctx.apns['keyfile']} doesn't exist")
    note = "" if platform == "sandbox" else " - debug builds from Xcode get sandbox tokens, which fail here"
    return f"key {app['key_id']}, platform {platform}{note}"


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


def simulator_tokens(udid=None):
    """APNs tokens the app stored (localStorage `nativePushToken`) on one or every Simulator."""
    devices = Path.home() / "Library/Developer/CoreSimulator/Devices"
    pattern = f"{udid or '*'}/data/Containers/Data/Application/*/Library/WebKit/{BUNDLE_ID}/WebsiteData/**/localstorage.sqlite3"
    tokens = set()
    for db in devices.glob(pattern):
        result = run("sqlite3", "-readonly", str(db), "select hex(value) from ItemTable where key='nativePushToken';",
                     check=False)
        for value in result.stdout.split():
            try:
                stored = json.loads(bytes.fromhex(value).decode("utf-16-le"))
            except ValueError:
                continue
            if stored.get("transport") == "apns":
                tokens.add(stored["token"])
    return tokens


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
        if not ctx.pushkey:
            tokens = simulator_tokens(ctx.udid)
            if len(tokens) != 1:
                raise Fail("the app has no APNs token stored yet: open it and allow notifications"
                           if not tokens else "found several APNs tokens, pick one with --pushkey")
            ctx.pushkey = tokens.pop()
        return f"{booted[0]['name']} ({ctx.udid}), token {ctx.pushkey[:16]}…"

    if ctx.pushkey:
        return f"token {ctx.pushkey[:16]}… (--pushkey)"
    simulators = simulator_tokens()
    pushers = [p for p in ctx.query("select pushkey, ts, data from pushers where app_id = ? order by ts desc", APP_ID)
               if p[0] not in simulators]
    if not pushers:
        raise Fail(f"no iOS pusher from a device on testhub{ctx.n}: log in to it in the app on the device")
    # Prefer a pusher that points at the hub's current address: older ones are from earlier networks.
    pushers.sort(key=lambda p: json.loads(p[2]).get("url", "").startswith(ctx.public_baseurl), reverse=True)
    ctx.pushkey = pushers[0][0]
    others = f" ({len(pushers) - 1} other device pusher(s); use --pushkey to pick)" if len(pushers) > 1 else ""
    return f"token {ctx.pushkey[:16]}…{others}"


def step_pusher(ctx):
    rows = ctx.query("select user_name, data, enabled from pushers where app_id = ? and pushkey = ?", APP_ID, ctx.pushkey)
    if not rows:
        raise Fail(f"no pusher for this token on testhub{ctx.n}: log in to the hub in the app (it registers on launch)")
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
    return f"{user} -> {data['url']}"


def check_dispatch(ctx, event_id, since):
    lines = ctx.sygnal_dispatch(event_id, since)
    if lines is None:
        raise Fail("Sygnal never sent this push to Apple")
    bad = [line for line in lines if re.search(r"WARNING|ERROR|was rejected|Temporary failure", line)]
    if bad:
        raise Fail("Sygnal: " + bad[0].split("] ", 2)[-1])


def step_gateway(ctx):
    ctx.to_background()
    since = int(time.time()) - 1
    event_id = f"$ios-push-test-gateway-{int(time.time())}"
    status, body = ctx.notify(event_id)
    if status != 200:
        raise Fail(f"push gateway answered {status}: {body.strip()[:200]}")
    rejected = json.loads(body).get("rejected")
    if rejected:
        raise Fail("Apple rejected the token (BadDeviceToken/Unregistered, or a sandbox token on production)")
    check_dispatch(ctx, event_id, since)
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
    event_id = response["event_id"]
    lines = ctx.sygnal_dispatch(event_id, since)
    if lines is None:
        failed = re.search(r"Failed to push data to " + re.escape(f"{user}/{APP_ID}/{ctx.pushkey}") + r": (.*)",
                           ctx.logs(since))
        raise Fail(f"Synapse couldn't reach the push gateway: {failed.group(1)}" if failed else
                   f"Synapse didn't push for {event_id}: is the room muted, or are push rules off for {user}?")
    check_dispatch(ctx, event_id, since)
    return f"{sender} wrote in {room_id}, Apple accepted Synapse's push; {ctx.check_banner('e2e')}"


def step_foreground(ctx):
    if ctx.simulator:
        with SimConsole(ctx, "foreground") as console:
            console.to_foreground()
            status, body = ctx.notify(f"$ios-push-test-foreground-{int(time.time())}")
            if status != 200 or json.loads(body).get("rejected"):
                raise Fail(f"push gateway answered {status}: {body.strip()[:200]}")
            time.sleep(4)
            ctx.screenshot("foreground")
            if not console.received_hub_id():
                raise Fail(f"JS never got pushReceived with hub_id {ctx.hub_id} (see {console.path})")
        return f"JS got pushReceived(hub_id={ctx.hub_id}); screenshot should show no banner"
    if not ctx.interactive:
        raise Skip("needs someone watching the device")
    ctx.wait_for_user("Open PubHubs on the device and keep it in the foreground")
    status, body = ctx.notify(f"$ios-push-test-foreground-{int(time.time())}")
    if status != 200 or json.loads(body).get("rejected"):
        raise Fail(f"push gateway answered {status}: {body.strip()[:200]}")
    ctx.ask(f"No banner, and the app switched to testhub{ctx.n}?")
    return "no banner, app went to the hub"


def step_tap(ctx):
    if not ctx.interactive:
        raise Skip("needs someone to tap the banner")

    def push_and_tap():
        ctx.to_background()
        status, body = ctx.notify(f"$ios-push-test-tap-{int(time.time())}")
        if status != 200 or json.loads(body).get("rejected"):
            raise Fail(f"push gateway answered {status}: {body.strip()[:200]}")
        ctx.wait_for_user("Tap the banner")
        time.sleep(3)

    if ctx.simulator:
        with SimConsole(ctx, "tap") as console:
            push_and_tap()
            if not console.received_hub_id():
                raise Fail(f"JS never got pushReceived with hub_id {ctx.hub_id} (see {console.path})")
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
    parser.add_argument("--pushkey", help="APNs device token to push to, instead of looking it up")
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
