#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${EXPO_PUBLIC_MEME_API_URL:-}" ]]; then
  echo "EXPO_PUBLIC_MEME_API_URL is required." >&2
  exit 2
fi

if [[ ! -f package-lock.json || ! -d android ]]; then
  echo "Mount the complete wechat-meme-mobile project at /workspace." >&2
  exit 2
fi

mkdir -p /output
npm ci
# Git checkouts created on Windows may not preserve the executable bit of
# android/gradlew. Invoke it through Bash so local Docker and GitHub Actions
# builds do not depend on that filesystem metadata.
bash ./android/gradlew --no-daemon :app:assembleRelease
install -m 0644 android/app/build/outputs/apk/release/app-release.apk "/output/${APK_OUTPUT_NAME:-meme-reply-release.apk}"
