#!/usr/bin/env bash
set -euo pipefail

# Runs inside the mobile repository on the NAS. It controls the existing
# budtmo Android container through its in-container ADB server, so no Android
# Studio, noVNC clicks, or manual image selection is needed.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_CONTAINER="${ANDROID_CONTAINER:-meme-reply-android-compose-latest-android-1}"
APK_PATH="${APK_PATH:?Set APK_PATH to the release APK on the NAS host}"
: "${E2E_EMAIL:?Set E2E_EMAIL only in the NAS shell or its secret store}"
: "${E2E_PASSWORD:?Set E2E_PASSWORD only in the NAS shell or its secret store}"

FLOW_DIR="/tmp/meme-reply-maestro"
DEVICE_ID="${ANDROID_DEVICE_ID:-emulator-5554}"
MEDIA_FILE="/sdcard/Download/meme-e2e.png"
MEDIA_DATA="/storage/emulated/0/Download/meme-e2e.png"

adb_in_container() {
  docker exec "$ANDROID_CONTAINER" adb "$@"
}

echo '[1/6] Waiting for Android emulator…'
for _ in $(seq 1 60); do
  if adb_in_container get-state 2>/dev/null | grep -qx device; then break; fi
  sleep 2
done
adb_in_container get-state | grep -qx device || { echo 'Android emulator did not become ready.' >&2; exit 1; }

echo '[2/6] Installing the requested APK and clearing previous App data…'
docker cp "$APK_PATH" "$ANDROID_CONTAINER:/tmp/meme-reply-e2e.apk"
adb_in_container install -r /tmp/meme-reply-e2e.apk
adb_in_container shell pm clear com.local.memereply >/dev/null

echo '[3/6] Registering a deterministic test image in Android MediaStore…'
adb_in_container push "$ROOT_DIR/assets/app-icon.png" "$MEDIA_FILE" >/dev/null
adb_in_container shell content delete --uri content://media/external/images/media --where '_data=?' --bind "_data:s:$MEDIA_DATA" >/dev/null 2>&1 || true
adb_in_container shell content insert --uri content://media/external/images/media --bind "_data:s:$MEDIA_DATA" --bind 'mime_type:s:image/png' >/dev/null

echo '[4/6] Copying the Maestro flow into the emulator container…'
docker exec "$ANDROID_CONTAINER" rm -rf "$FLOW_DIR"
docker cp "$ROOT_DIR/maestro" "$ANDROID_CONTAINER:$FLOW_DIR"

echo '[5/6] Ensuring the Maestro CLI is available…'
docker exec "$ANDROID_CONTAINER" sh -lc 'command -v maestro >/dev/null 2>&1 || (curl -fsSL https://get.maestro.mobile.dev | bash)'

echo '[6/6] Running login → photo picker → image generation → preview assertions…'
docker exec \
  -e E2E_EMAIL \
  -e E2E_PASSWORD \
  "$ANDROID_CONTAINER" \
  sh -lc "export PATH=\"\$HOME/.maestro/bin:\$PATH\"; maestro --device '$DEVICE_ID' test '$FLOW_DIR/e2e-generation.yaml'"

echo 'E2E PASSED: the generated image result card was rendered.'
