#!/usr/bin/env bash
# Smoke test for the iOS app: builds it, installs it on a Simulator (default "iPhone 11") or a
# connected device, launches it, and watches the app's console for a while. See docs/app/README.md.
#
# Passes when Capacitor loads the shell and, during --timeout seconds, the app logs no JS errors
# (`⚡️  [error] - ...`, which includes the login page failing to reach PubHubs Central), has no
# WebView load failures and doesn't crash. The production web build only logs warnings and errors,
# so there is no positive "login page ready" signal; check the screenshot for that.
#
# Usage: scripts/ios-smoke-test.sh [options]   (or: npm run test:ios -- [options])
#   --simulator <name|udid>  Simulator to use (default: "iPhone 11", on the newest runtime that has it)
#   --os <version>           Runtime for --simulator by name, for example 17.5
#   --device <name|udid>     A connected physical device instead of a Simulator. iOS 17 and later
#                            use devicectl, older devices ios-deploy (brew install ios-deploy)
#   --list                   List available Simulators and connected devices, and exit
#   --no-sync                Skip `npm run cap:sync:ios` and reuse the last web build
#   --timeout <seconds>      How long to watch the app once it has loaded (default: 30)
#   --ignore-error <regex>   Don't fail on app errors matching this (extended) regex; repeatable,
#                            for example --ignore-error "Testhub 1" when that hub isn't running
#   --keep-running           Leave the app running afterwards (not on iOS 16 and older devices,
#                            where the app runs under ios-deploy's debugger)
#   -h, --help               Show this help

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUNDLE_ID="net.pubhubs.app"
PROJECT="$REPO_ROOT/ios/App/App.xcodeproj"
DERIVED_DATA="$REPO_ROOT/ios/DerivedData/smoke-test"
RESULTS_DIR="$DERIVED_DATA/results/$(date +%Y%m%d-%H%M%S)"

simulator="iPhone 11"
os_version=""
device=""
do_sync=1
timeout=30
keep_running=0
ignore_errors=()

usage() {
	sed -n '/^# Usage:/,/^$/p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

die() {
	echo "ios-smoke-test: $*" >&2
	exit 2
}

# Connected iOS devices as "name<TAB>version<TAB>udid" lines. From xctrace, which, like Xcode, sees
# every device; devicectl only sees iOS 17 and later. Skips the Mac itself and offline devices.
connected_devices() {
	xcrun xctrace list devices 2>/dev/null |
		awk '/^== Devices ==/ { on = 1; next } /^== / { on = 0 } on' |
		sed -nE 's/^(.*) \(([0-9][0-9.]*)\) \(([0-9A-Fa-f-]+)\)$/\1	\2	\3/p'
}

list_destinations() {
	echo "Simulators:"
	xcrun simctl list devices available -j |
		jq -r '.devices | to_entries[] | (.key | sub(".*SimRuntime\\.iOS-"; "iOS ") | gsub("-"; ".")) as $os | .value[] | "  \(.name) (\($os)) \(.udid) [\(.state)]"' |
		grep -E '^  .* \(iOS ' || true
	echo
	echo "Connected devices:"
	connected_devices | while IFS=$'\t' read -r name version id; do
		echo "  $name (iOS $version) $id"
	done
}

while [[ $# -gt 0 ]]; do
	case "$1" in
		--simulator) simulator="${2:?--simulator needs a value}"; shift 2 ;;
		--os) os_version="${2:?--os needs a value}"; shift 2 ;;
		--device) device="${2:?--device needs a value}"; shift 2 ;;
		--list) list_destinations; exit 0 ;;
		--no-sync) do_sync=0; shift ;;
		--timeout) timeout="${2:?--timeout needs a value}"; shift 2 ;;
		--ignore-error) ignore_errors+=("${2:?--ignore-error needs a value}"); shift 2 ;;
		--keep-running) keep_running=1; shift ;;
		-h | --help) usage; exit 0 ;;
		*) die "unknown option: $1 (see --help)" ;;
	esac
done

[[ "$timeout" =~ ^[0-9]+$ ]] || die "--timeout must be a number of seconds"
for tool in xcodebuild xcrun jq npm curl; do
	command -v "$tool" >/dev/null || die "$tool not found"
done

mkdir -p "$RESULTS_DIR"
BUILD_LOG="$RESULTS_DIR/build.log"
APP_LOG="$RESULTS_DIR/app.log"
SCREENSHOT="$RESULTS_DIR/screenshot.png"

step() { printf '\n==> %s\n' "$*"; }

# --- Destination -------------------------------------------------------------------------------

udid=""
if [[ -n "$device" ]]; then
	match="$(connected_devices | awk -F'\t' -v d="$device" '$1 == d || $3 == d { print; exit }')"
	[[ -n "$match" ]] || die "no connected device '$device' (see --list)"
	IFS=$'\t' read -r device_name device_os udid <<<"$match"
	# devicectl (CoreDevice) only handles iOS 17 and later; older devices go through ios-deploy.
	if [[ "${device_os%%.*}" -ge 17 ]]; then
		device_tool="devicectl"
	else
		device_tool="ios-deploy"
		command -v ios-deploy >/dev/null || die "$device_name runs iOS $device_os, which needs ios-deploy (brew install ios-deploy)"
	fi
	destination_label="device $device_name, iOS $device_os ($udid)"
else
	# Newest runtime first, so a name like "iPhone 11" picks the most recent iOS that has it.
	udid="$(xcrun simctl list devices available -j | jq -r --arg s "$simulator" --arg os "$os_version" '
		[.devices | to_entries[]
			| select(.key | test("SimRuntime\\.iOS-"))
			| (.key | sub(".*SimRuntime\\.iOS-"; "") | split("-") | map(tonumber)) as $ver
			| select($os == "" or ($ver | map(tostring) | join(".")) == $os or ($ver | map(tostring) | join(".") | startswith($os + ".")))
			| .value[] | select(.udid == $s or .name == $s) | {udid, ver: $ver}]
		| sort_by(.ver) | last | .udid // empty')"
	[[ -n "$udid" ]] || die "no available Simulator '$simulator'${os_version:+ on iOS $os_version} (see --list)"
	destination_label="Simulator $simulator ($udid)"
fi
echo "ios-smoke-test: testing on $destination_label"
echo "ios-smoke-test: results in ${RESULTS_DIR#"$REPO_ROOT/"}"

# --- Web build and sync --------------------------------------------------------------------------

if [[ $do_sync -eq 1 ]]; then
	step "Building the web clients and syncing them into ios/ (npm run cap:sync:ios)"
	(cd "$REPO_ROOT" && npm run cap:sync:ios) >"$RESULTS_DIR/sync.log" 2>&1 || {
		tail -n 40 "$RESULTS_DIR/sync.log"
		echo "FAIL: cap:sync:ios failed, see $RESULTS_DIR/sync.log"
		exit 1
	}
fi

# The servers the app will talk to, from the config that actually goes into the app.
APP_CONFIG="$REPO_ROOT/ios/App/App/public/client-config.js"
[[ -f "$APP_CONFIG" ]] || die "$APP_CONFIG is missing; run without --no-sync"
for key in PHC_URL PUBHUBS_URL; do
	url="$(sed -nE "s/.*$key:[[:space:]]*'([^']*)'.*/\1/p" "$APP_CONFIG" | head -n 1)"
	if [[ -n "$url" ]] && ! curl -s -o /dev/null --max-time 5 "$url"; then
		echo "warning: $key $url does not answer; the app will probably show its error page"
	fi
done

# --- Native build --------------------------------------------------------------------------------

if [[ -n "$device" ]]; then
	sdk="iphoneos"
	signing_args=()
else
	sdk="iphonesimulator"
	signing_args=(CODE_SIGNING_ALLOWED=NO)
fi

step "Building the app (xcodebuild, Debug, $sdk)"
if ! xcodebuild -project "$PROJECT" -scheme App -configuration Debug -sdk "$sdk" \
	-destination "id=$udid" -derivedDataPath "$DERIVED_DATA" ${signing_args[@]+"${signing_args[@]}"} build \
	>"$BUILD_LOG" 2>&1; then
	grep -E 'error:|BUILD FAILED' "$BUILD_LOG" | tail -n 20 || tail -n 40 "$BUILD_LOG"
	if [[ -n "$device" ]] && grep -qiE 'provisioning profile|signing certificate|code sign' "$BUILD_LOG"; then
		echo "Signing failed: a device build needs the 'PubHubs - development' profile and the Apple Development certificate, see docs/app/README.md."
	fi
	echo "FAIL: build failed, see $BUILD_LOG"
	exit 1
fi
APP_PATH="$DERIVED_DATA/Build/Products/Debug-$sdk/App.app"
[[ -d "$APP_PATH" ]] || die "built app not found at $APP_PATH"
echo "Built $APP_PATH"

# --- Install and launch --------------------------------------------------------------------------

console_pid=""
cleanup() {
	if [[ -n "$console_pid" ]] && kill -0 "$console_pid" 2>/dev/null; then
		if [[ $keep_running -eq 1 ]]; then
			# Stop following the console, leave the app alone.
			disown "$console_pid" 2>/dev/null || true
		else
			kill "$console_pid" 2>/dev/null || true
			wait "$console_pid" 2>/dev/null || true
		fi
	fi
	if [[ $keep_running -eq 0 ]]; then
		if [[ "${device_tool:-}" == "ios-deploy" ]]; then
			# Ending the lldb session also ends the app.
			pkill -f "ios-deploy --id $udid" 2>/dev/null || true
		fi
		if [[ -z "$device" ]]; then
			xcrun simctl terminate "$udid" "$BUNDLE_ID" >/dev/null 2>&1 || true
		fi
	fi
}
trap cleanup EXIT

if [[ -z "$device" ]]; then
	step "Booting the Simulator and installing the app"
	xcrun simctl boot "$udid" 2>/dev/null || true
	open -a Simulator --args -CurrentDeviceUDID "$udid" || true
	xcrun simctl bootstatus "$udid" -b >/dev/null
	xcrun simctl install "$udid" "$APP_PATH"

	step "Launching $BUNDLE_ID"
	# --console-pty: the app's stdout is a terminal, so Capacitor's print()s aren't buffered.
	xcrun simctl launch --console-pty --terminate-running-process "$udid" "$BUNDLE_ID" >"$APP_LOG" 2>&1 &
	console_pid=$!
else
	step "Installing the app on the device ($device_tool)"
	if [[ "$device_tool" == "devicectl" ]]; then
		install_cmd=(xcrun devicectl device install app --device "$udid" "$APP_PATH")
	else
		install_cmd=(ios-deploy --id "$udid" --bundle "$APP_PATH")
	fi
	"${install_cmd[@]}" >"$RESULTS_DIR/install.log" 2>&1 || {
		tail -n 20 "$RESULTS_DIR/install.log"
		echo "FAIL: install failed, see $RESULTS_DIR/install.log"
		exit 1
	}

	step "Launching $BUNDLE_ID (unlock the device if it is locked)"
	if [[ "$device_tool" == "devicectl" ]]; then
		xcrun devicectl device process launch --console --terminate-existing --device "$udid" "$BUNDLE_ID" >"$APP_LOG" 2>&1 &
	else
		# Launches under lldb and passes the app's stdout through until the app exits. Under script(1),
		# so ios-deploy's output is a terminal: written to a file, it is buffered and never arrives.
		script -q "$APP_LOG" ios-deploy --id "$udid" --bundle "$APP_PATH" --noinstall --noninteractive --debug </dev/null >/dev/null 2>&1 &
	fi
	console_pid=$!
fi

# --- Watch the console ---------------------------------------------------------------------------

FAILURE_RE='⚡️  \[error\]|WebView failed to load|WebView failed provisional navigation|ERROR: Unable to (load|find application directory)|FATAL ERROR|WebView process terminated'
LAUNCH_TIMEOUT=120
LOADED_RE='⚡️  Loading app at capacitor://pubhubs-app\.invalid'

# The app's failure lines, without the ones --ignore-error allows.
failure_lines() {
	local lines
	lines="$(grep -E "$FAILURE_RE" "$APP_LOG" || true)"
	for pattern in ${ignore_errors[@]+"${ignore_errors[@]}"}; do
		lines="$(grep -vE -- "$pattern" <<<"$lines" || true)"
	done
	[[ -n "$lines" ]] && echo "$lines"
}

# Checks the app once; sets result/reason on a failure. Returns 1 when the test should stop.
check_app() {
	if failure_lines >/dev/null; then
		result="FAIL"
		reason="the app logged an error"
		return 1
	fi
	if ! kill -0 "$console_pid" 2>/dev/null; then
		result="FAIL"
		reason="the app exited or could not be launched"
		return 1
	fi
}

result=""
reason=""

# A freshly booted Simulator can take a while before the app even starts, so the --timeout window
# only starts once Capacitor has loaded the shell.
step "Waiting up to ${LAUNCH_TIMEOUT}s for the app to load"
for ((elapsed = 0; elapsed < LAUNCH_TIMEOUT; elapsed++)); do
	grep -qE "$LOADED_RE" "$APP_LOG" && break
	check_app || break
	sleep 1
done
if [[ -z "$result" ]] && ! grep -qE "$LOADED_RE" "$APP_LOG"; then
	result="FAIL"
	reason="Capacitor didn't load the app within ${LAUNCH_TIMEOUT}s (no 'Loading app at capacitor://pubhubs-app.invalid')"
fi

if [[ -z "$result" ]]; then
	echo "Loaded after ${elapsed}s"
	step "Watching the app for ${timeout}s"
	for ((elapsed = 0; elapsed < timeout; elapsed++)); do
		sleep 1
		check_app || break
	done
	[[ -n "$result" ]] || result="PASS"
fi

if [[ -z "$device" ]]; then
	xcrun simctl io "$udid" screenshot "$SCREENSHOT" >/dev/null 2>&1 || SCREENSHOT=""
else
	SCREENSHOT=""
fi

# --- Report --------------------------------------------------------------------------------------

echo
ignored="$(grep -E "$FAILURE_RE" "$APP_LOG" | grep -vxF -f <(failure_lines || true) || true)"
if [[ -n "$ignored" ]]; then
	echo "Ignored errors (--ignore-error):"
	echo "$ignored" | sed 's/^/  /' | head -n 20
	echo
fi
if grep -qE '⚡️  \[warn\]' "$APP_LOG"; then
	echo "Warnings from the app:"
	grep -E '⚡️  \[warn\]' "$APP_LOG" | sed 's/^/  /' | head -n 20
	echo
fi
if [[ "$result" == "FAIL" ]]; then
	echo "Relevant app log lines:"
	failure_lines | sed 's/^/  /' | head -n 20 || tail -n 20 "$APP_LOG" | sed 's/^/  /'
	echo
	if failure_lines | grep -qE 'Could not reach|Could not fetch|needs_connection|network'; then
		echo "Looks like a server the app needs isn't running or reachable; check the dev setup."
		echo "To ignore a hub you don't run, pass --ignore-error '<hub name>'."
		echo
	fi
fi

echo "App log:    $APP_LOG"
echo "Build log:  $BUILD_LOG"
[[ -n "$SCREENSHOT" ]] && echo "Screenshot: $SCREENSHOT"
echo
if [[ "$result" == "PASS" ]]; then
	echo "PASS: the app loaded on $destination_label and ran ${timeout}s without errors"
	exit 0
fi
echo "FAIL: $reason"
exit 1
