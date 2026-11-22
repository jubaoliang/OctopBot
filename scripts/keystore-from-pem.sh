#!/usr/bin/env bash
# Rebuild the Android release keystore from the PEM pair.
#
# The keystore is just a container: the signing identity lives in the private key
# and its certificate, both of which are ASCII PEM. Keep those two files as the
# source of truth (password manager, text note, whatever survives) and regenerate
# the binary whenever a build needs it.
#
# Usage: scripts/keystore-from-pem.sh [--force]
#   KEYSTORE_PASSWORD=... scripts/keystore-from-pem.sh
#
# Never regenerate a new key pair instead — a different key cannot update an
# already-installed app under the same package name.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

KEY="${KEY_PEM:-release-key.pem}"
CERT="${CERT_PEM:-release-cert.pem}"
OUT="${KEYSTORE:-release.keystore}"
ALIAS="${ALIAS:-octopbot}"

for f in "$KEY" "$CERT"; do
  [ -f "$f" ] || {
    echo "error: $f not found — restore it from your password manager first." >&2
    exit 1
  }
done

if [ -e "$OUT" ] && [ "${1:-}" != "--force" ]; then
  echo "error: $OUT already exists — pass --force to rebuild it." >&2
  echo "       Rebuilding produces the same identity, so this is only about not" >&2
  echo "       clobbering a file by accident." >&2
  exit 1
fi

: "${KEYSTORE_PASSWORD:?set KEYSTORE_PASSWORD (the keystore password) first}"
export KS_PASS="$KEYSTORE_PASSWORD"

# 0600 from the first byte; the container holds the private key.
umask 077
openssl pkcs12 -export \
  -inkey "$KEY" -in "$CERT" \
  -name "$ALIAS" \
  -out "$OUT" \
  -passout env:KS_PASS

# Fail loudly if the result is not a readable PKCS12 with our alias.
if ! openssl pkcs12 -info -noout -in "$OUT" -passin env:KS_PASS >/dev/null 2>&1; then
  echo "error: $OUT is not a readable PKCS12 file" >&2
  exit 1
fi

echo "wrote $OUT"
echo "fingerprint:"
openssl pkcs12 -in "$OUT" -nokeys -clcerts -passin env:KS_PASS 2>/dev/null |
  openssl x509 -noout -fingerprint -sha256
