#!/usr/bin/env bash
set -euo pipefail

OUT_DIR="${1:-.mindbuild-signing}"
STORE_PASSWORD="${RELEASE_STORE_PASSWORD:-}"
KEY_PASSWORD="${RELEASE_KEY_PASSWORD:-}"
KEY_ALIAS="${RELEASE_KEY_ALIAS:-mindbuild-release}"

if [[ -z "$STORE_PASSWORD" || -z "$KEY_PASSWORD" ]]; then
  echo "Set RELEASE_STORE_PASSWORD and RELEASE_KEY_PASSWORD before generating a key." >&2
  exit 1
fi

umask 077
mkdir -p "$OUT_DIR"
STORE_FILE="$OUT_DIR/MindBuild-release-signing.jks"
keytool -genkeypair \
  -keystore "$STORE_FILE" \
  -storetype JKS \
  -storepass "$STORE_PASSWORD" \
  -keypass "$KEY_PASSWORD" \
  -alias "$KEY_ALIAS" \
  -keyalg RSA \
  -keysize 4096 \
  -sigalg SHA256withRSA \
  -validity 10000 \
  -dname "CN=MindBuild Release, OU=Android, O=MindBuild, L=NA, ST=NA, C=US"

base64 -w 0 "$STORE_FILE" > "$OUT_DIR/RELEASE_KEYSTORE_B64.txt"
cat > "$OUT_DIR/release-signing.env" <<EOF
RELEASE_STORE_FILE=$STORE_FILE
RELEASE_STORE_PASSWORD=$STORE_PASSWORD
RELEASE_KEY_ALIAS=$KEY_ALIAS
RELEASE_KEY_PASSWORD=$KEY_PASSWORD
EOF
chmod 600 "$STORE_FILE" "$OUT_DIR/RELEASE_KEYSTORE_B64.txt" "$OUT_DIR/release-signing.env"
sha256sum "$STORE_FILE" > "$OUT_DIR/SHA256SUMS.txt"
echo "Generated $STORE_FILE"
echo "Keep the keystore and passwords offline; do not commit this directory."
