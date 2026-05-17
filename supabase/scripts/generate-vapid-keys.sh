#!/usr/bin/env bash
# One-time. Generates a VAPID keypair for Zameen Web Push.
# Paste the output into .env (web/field/ops/approve all read the same vars).
#
#   NEXT_PUBLIC_ZAMEEN_VAPID_PUBLIC_KEY=...  (also expose as ZAMEEN_VAPID_PUBLIC_KEY)
#   ZAMEEN_VAPID_PRIVATE_KEY=...
#   ZAMEEN_VAPID_SUBJECT=mailto:meerfeerasta@gmail.com
#
# Never log or commit the private key.

set -euo pipefail

node -e "const w=require('web-push');const k=w.generateVAPIDKeys();console.log('NEXT_PUBLIC_ZAMEEN_VAPID_PUBLIC_KEY='+k.publicKey);console.log('ZAMEEN_VAPID_PUBLIC_KEY='+k.publicKey);console.log('ZAMEEN_VAPID_PRIVATE_KEY='+k.privateKey);console.log('ZAMEEN_VAPID_SUBJECT=mailto:meerfeerasta@gmail.com');"
