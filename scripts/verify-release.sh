#!/usr/bin/env bash
set -euo pipefail

DIST_DIR="${1:-dist}"
shopt -s nullglob
apk_files=("$DIST_DIR"/*.apk)
aab_files=("$DIST_DIR"/*.aab)

if ((${#apk_files[@]} == 0 && ${#aab_files[@]} == 0)); then
  echo "No APK or AAB was found in $DIST_DIR" >&2
  exit 1
fi

for apk in "${apk_files[@]}"; do
  command -v apksigner >/dev/null || { echo "apksigner is required to verify APKs" >&2; exit 1; }
  apksigner verify --verbose --print-certs "$apk"
done

for aab in "${aab_files[@]}"; do
  jarsigner -verify -certs "$aab" >/tmp/mindbuild-jarsigner.txt
  grep -Eq 'jar verified\.' /tmp/mindbuild-jarsigner.txt || {
    echo "AAB signature verification did not report a valid signature: $aab" >&2
    cat /tmp/mindbuild-jarsigner.txt >&2
    exit 1
  }
done

sha256sum "$DIST_DIR"/*
echo "Release signature verification passed."
