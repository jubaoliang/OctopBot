#!/usr/bin/env bash
# Seed the OctopBot dev client with a live session via deep link.
# Usage: scripts/e2e-seed-session.sh android|ios
set -euo pipefail

PLATFORM="${1:-}"
if [[ "$PLATFORM" != "android" && "$PLATFORM" != "ios" ]]; then
  echo "Usage: $0 android|ios" >&2
  exit 1
fi

CREDS="${HOME}/.octop-rr-creds"
if [[ ! -f "$CREDS" ]]; then
  echo "Missing credentials file at ~/.octop-rr-creds (URL= USERNAME= PASSWORD=)" >&2
  exit 1
fi

DEEPLINK=$(python3 - <<'PY'
import json, ssl, urllib.parse, urllib.request
from pathlib import Path

creds = {}
for line in Path.home().joinpath(".octop-rr-creds").read_text().splitlines():
    if "=" in line:
        k, v = line.split("=", 1)
        creds[k.strip()] = v.strip()
base = creds["URL"].rstrip("/")
ctx = ssl.create_default_context()
ua = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)
req = urllib.request.Request(
    base + "/api/auth/login",
    data=json.dumps({"username": creds["USERNAME"], "password": creds["PASSWORD"]}).encode(),
    headers={
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": ua,
        "Origin": base,
        "Referer": base + "/",
    },
    method="POST",
)
with urllib.request.urlopen(req, context=ctx, timeout=60) as resp:
    token = json.load(resp)["access_token"]
print(
    "octopbot://dev-session?url="
    + urllib.parse.quote(base, safe="")
    + "&token="
    + urllib.parse.quote(token, safe="")
)
PY
)

case "$PLATFORM" in
  android)
    adb reverse tcp:8081 tcp:8081 >/dev/null 2>&1 || true
    adb shell am force-stop dev.octop.octopbot || true
    # Quote the deep link for the device shell (& separates background jobs otherwise).
    adb shell "am start -a android.intent.action.VIEW -d '$DEEPLINK' -p dev.octop.octopbot" >/dev/null
    ;;
  ios)
    export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"
    xcrun simctl terminate booted dev.octop.octopbot >/dev/null 2>&1 || true
    xcrun simctl openurl booted "$DEEPLINK"
    ;;
esac

echo "Seeded $PLATFORM session"
