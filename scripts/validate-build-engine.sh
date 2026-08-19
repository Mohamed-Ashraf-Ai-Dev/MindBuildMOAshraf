#!/usr/bin/env bash
set -euo pipefail

required=(
  "settings.gradle.kts"
  "build.gradle.kts"
  "gradle/libs.versions.toml"
  "app/build.gradle.kts"
  "gradlew"
  ".github/workflows/build-android.yml"
  "scripts/verify-release.sh"
)
for path in "${required[@]}"; do
  test -f "$path" || { echo "Missing required build-engine file: $path" >&2; exit 1; }
done

test -x gradlew || { echo "gradlew must be executable" >&2; exit 1; }
grep -q 'RELEASE_KEYSTORE_B64' .github/workflows/build-android.yml
grep -q 'actions/upload-artifact@v4' .github/workflows/build-android.yml
grep -q 'permissions:' .github/workflows/build-android.yml

test -z "$(git ls-files | grep -Ei '(^|/)(.*\.(jks|keystore|p12|pfx|pem))$' || true)" || {
  echo "Signing key material must never be committed to Git" >&2
  exit 1
}

echo "Build engine validation passed."
