#!/usr/bin/env bash
set -euo pipefail

# Runs on the NAS host and drives the existing docker-android emulator without
# Maestro, noVNC, or any manual interaction. It never prints credentials,
# authorization headers, Base64 image data, or UI XML.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_CONTAINER="${ANDROID_CONTAINER:-meme-reply-android-compose-latest-android-1}"
APK_PATH="${APK_PATH:?Set APK_PATH to the release APK on the NAS host}"
: "${E2E_EMAIL:?Set E2E_EMAIL only in the NAS shell or secret store}"
: "${E2E_PASSWORD:?Set E2E_PASSWORD only in the NAS shell or secret store}"

PACKAGE='com.local.memereply'
DEVICE_ID="${ANDROID_DEVICE_ID:-emulator-5554}"
MEDIA_FILE='/sdcard/Download/meme-e2e.png'
MEDIA_DATA='/storage/emulated/0/Download/meme-e2e.png'
WINDOW_XML='/sdcard/meme-reply-window.xml'

adb() { docker exec "$ANDROID_CONTAINER" adb -s "$DEVICE_ID" "$@"; }
shell() { adb shell "$1"; }
ui_xml() { shell "uiautomator dump $WINDOW_XML >/dev/null && cat $WINDOW_XML"; }

wait_for_text() {
  local text="$1" timeout_seconds="$2" elapsed=0
  while (( elapsed < timeout_seconds )); do
    if ui_xml | grep -Fq "$text"; then return 0; fi
    sleep 2
    elapsed=$((elapsed + 2))
  done
  echo "Assertion failed: expected UI text was not found within ${timeout_seconds}s." >&2
  return 1
}

tap_text() {
  local text="$1" node bounds x1 y1 x2 y2
  node="$(ui_xml | grep -o "<node[^>]*text=\"$text\"[^>]*>" | head -n 1 || true)"
  [[ -n "$node" ]] || { echo 'Assertion failed: tappable UI text was not found.' >&2; return 1; }
  bounds="$(printf '%s' "$node" | sed -nE 's/.*bounds="\[([0-9]+),([0-9]+)\]\[([0-9]+),([0-9]+)\]".*/\1 \2 \3 \4/p')"
  read -r x1 y1 x2 y2 <<< "$bounds"
  [[ -n "${x2:-}" ]] || { echo 'Assertion failed: UI element had no bounds.' >&2; return 1; }
  shell "input tap $(((x1 + x2) / 2)) $(((y1 + y2) / 2))"
}

type_text() {
  local value="$1" index character
  for (( index = 0; index < ${#value}; index++ )); do
    character="${value:index:1}"
    # Separate commands avoid React Native dropping a long synthetic paste.
    shell "input text $character" >/dev/null
    sleep 0.15
  done
}

echo '[1/8] Waiting for Android emulator…'
for _ in $(seq 1 60); do
  if adb get-state 2>/dev/null | grep -qx device; then break; fi
  sleep 2
done
adb get-state | grep -qx device || { echo 'Android emulator did not become ready.' >&2; exit 1; }

echo '[2/8] Installing APK and resetting App data…'
docker cp "$APK_PATH" "$ANDROID_CONTAINER:/tmp/meme-reply-e2e.apk"
docker exec -u 0 "$ANDROID_CONTAINER" chmod 0644 /tmp/meme-reply-e2e.apk
adb install -r /tmp/meme-reply-e2e.apk >/dev/null
shell "pm clear $PACKAGE" >/dev/null

echo '[3/8] Registering deterministic PNG in Android MediaStore…'
TEST_IMAGE="$ROOT_DIR/assets/app-icon.png"
[[ -f "$TEST_IMAGE" ]] || TEST_IMAGE="$ROOT_DIR/android/app/src/main/res/mipmap-xxxhdpi/app_icon.png"
[[ -f "$TEST_IMAGE" ]] || { echo 'Test PNG was not found.' >&2; exit 1; }
docker cp "$TEST_IMAGE" "$ANDROID_CONTAINER:/tmp/meme-e2e-source.png"
docker exec -u 0 "$ANDROID_CONTAINER" chmod 0644 /tmp/meme-e2e-source.png
adb push /tmp/meme-e2e-source.png "$MEDIA_FILE" >/dev/null
shell "content delete --uri content://media/external/images/media --where '_data=?' --bind '_data:s:$MEDIA_DATA' >/dev/null 2>&1 || true"
shell "content insert --uri content://media/external/images/media --bind '_data:s:$MEDIA_DATA' --bind 'mime_type:s:image/png' >/dev/null"

echo '[4/8] Starting App and authenticating…'
shell "am start -n $PACKAGE/.MainActivity" >/dev/null
wait_for_text '邮箱' 30
tap_text '邮箱'; type_text "$E2E_EMAIL"
tap_text '密码（至少 10 位）'; type_text "$E2E_PASSWORD"
# The password Done action maps to the same login handler as the visible button.
shell 'input keyevent 66'
wait_for_text '已登录：' 30

echo '[5/8] Selecting the registered source image…'
tap_text '＋ 选择收到的表情'
wait_for_text 'Recent' 20
# DocumentsUI's first recent tile is the image inserted above.
shell 'input tap 360 1216'
wait_for_text 'AI 生成新回击图' 30

echo '[6/8] Confirming privacy notice and starting image generation…'
for _ in $(seq 1 6); do
  if ui_xml | grep -Fq '我知道了'; then break; fi
  shell 'input swipe 720 2500 720 850 400'
  sleep 1
done
tap_text '我知道了'
for _ in $(seq 1 6); do
  if ui_xml | grep -Fq '生成一张新回击图'; then break; fi
  shell 'input swipe 720 2500 720 850 400'
  sleep 1
done
tap_text '生成一张新回击图'

echo '[7/8] Waiting for generated result (up to four minutes)…'
wait_for_text '生成完成' 240
wait_for_text '新回击图已显示在这里' 10

echo '[8/8] Verifying the rendered result state…'
ui_xml | grep -Fq '分享到微信'
ui_xml | grep -Fq '保存到表情库'
echo 'E2E PASSED: image was uploaded, generated, saved locally for preview, and rendered.'
