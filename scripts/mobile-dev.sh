#!/usr/bin/env bash
# mobile-dev.sh - dev shortcut for Capacitor shells.
#
# Usage:
#   ./scripts/mobile-dev.sh field           # start field dev server + QR + cap sync
#   ./scripts/mobile-dev.sh ops --live      # ops with live-reload mode
#   ./scripts/mobile-dev.sh field --android # one-shot android run
#   ./scripts/mobile-dev.sh field --ios     # one-shot ios open

set -euo pipefail

APP="${1:-field}"
shift || true

case "$APP" in
  field|ops) ;;
  *) echo "usage: $0 <field|ops> [--live] [--android] [--ios]"; exit 1 ;;
esac

MODE=qr
PLATFORM=
while [ "$#" -gt 0 ]; do
  case "$1" in
    --live) MODE=live ;;
    --android) PLATFORM=android ;;
    --ios) PLATFORM=ios ;;
    *) echo "unknown flag: $1"; exit 1 ;;
  esac
  shift
done

PORT_FIELD=3001
PORT_OPS=3002
if [ "$APP" = "field" ]; then PORT="$PORT_FIELD"; else PORT="$PORT_OPS"; fi

LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || echo 127.0.0.1)
DEV_URL="http://${LAN_IP}:${PORT}"

echo ""
echo "Zameen mobile-${APP} dev"
echo "  mode:     ${MODE}"
echo "  lan url:  ${DEV_URL}"
echo ""

# Start the PWA dev server in background.
( pnpm --filter "@zameen/${APP}" dev --hostname 0.0.0.0 --port "$PORT" ) &
DEV_PID=$!
trap 'kill $DEV_PID 2>/dev/null || true' EXIT

# Wait for server to come up
for _ in $(seq 1 30); do
  if curl -sf "${DEV_URL}" >/dev/null 2>&1; then break; fi
  sleep 1
done

# Print QR code for phone scanning.
if command -v npx >/dev/null 2>&1; then
  npx --yes qrcode-terminal "$DEV_URL" || true
else
  echo "install npx for QR code support"
fi

if [ "$MODE" = "live" ]; then
  # Live-reload: point Capacitor at the LAN dev server.
  pushd "apps/mobile-${APP}" >/dev/null
  ZAMEEN_FIELD_URL="$DEV_URL" ZAMEEN_OPS_URL="$DEV_URL" \
    npx cap run "$PLATFORM" --live-reload --external --port "$PORT" || true
  popd >/dev/null
else
  # One-shot sync (against deployed PWA URL).
  pushd "apps/mobile-${APP}" >/dev/null
  npx cap sync
  if [ -n "$PLATFORM" ]; then npx cap open "$PLATFORM"; fi
  popd >/dev/null
fi

wait $DEV_PID
