#!/usr/bin/env bash
# register-whatsapp-templates.sh
#
# Registers the four Zameen WhatsApp Business message templates with Meta.
# Run once per WABA. Meta typically takes 24-48h to approve templates.
#
# Required env vars:
#   META_WABA_ID                Meta WhatsApp Business Account ID
#   META_WHATSAPP_ADMIN_TOKEN   System user access token with whatsapp_business_management
#
# Usage:
#   META_WABA_ID=... META_WHATSAPP_ADMIN_TOKEN=... ./register-whatsapp-templates.sh
#
# Template parameter slots use digits only ({{1}}, {{2}}) because Meta does
# not support named placeholders. Amount strings should be pre-formatted
# with comma thousand-separators before being passed in as parameters.
#
# Templates:
#   zameen_approval_request    5 body params + 1 URL button (deep link)
#     {{1}} requester name
#     {{2}} approval type
#     {{3}} amount (formatted, e.g. "12,50,000")
#     {{4}} deep link (also bound to button URL parameter)
#     {{5}} entity name
#
#   zameen_approval_decision   4 body params + 1 URL button (deep link)
#     {{1}} decision (approved / rejected / sent back)
#     {{2}} approval type
#     {{3}} amount
#     {{4}} deep link
#
#   zameen_escalation_reminder 4 body params + 1 URL button (deep link)
#     {{1}} age in hours
#     {{2}} approval type
#     {{3}} amount
#     {{4}} deep link
#
#   zameen_otp                 1 body param
#     {{1}} 6-digit OTP code

set -euo pipefail

: "${META_WABA_ID:?set META_WABA_ID}"
: "${META_WHATSAPP_ADMIN_TOKEN:?set META_WHATSAPP_ADMIN_TOKEN}"

GRAPH="https://graph.facebook.com/v20.0"
ENDPOINT="${GRAPH}/${META_WABA_ID}/message_templates"

post() {
  local body="$1"
  curl -sS -X POST "${ENDPOINT}" \
    -H "Authorization: Bearer ${META_WHATSAPP_ADMIN_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "${body}"
  echo
}

echo "Registering zameen_approval_request"
post '{
  "name": "zameen_approval_request",
  "language": "en",
  "category": "UTILITY",
  "components": [
    {
      "type": "BODY",
      "text": "Approval request from {{1}}\nType: {{2}}\nAmount: Rs. {{3}}\nOpen: {{4}}\nEntity: {{5}}",
      "example": {
        "body_text": [["Asad", "diesel_purchase", "12,50,000", "https://approve.agri.feerasta.ai/abc", "AGRI"]]
      }
    },
    {
      "type": "BUTTONS",
      "buttons": [
        { "type": "URL", "text": "Open in Approver", "url": "https://approve.agri.feerasta.ai/{{1}}", "example": ["https://approve.agri.feerasta.ai/abc"] }
      ]
    }
  ]
}'

echo "Registering zameen_approval_decision"
post '{
  "name": "zameen_approval_decision",
  "language": "en",
  "category": "UTILITY",
  "components": [
    {
      "type": "BODY",
      "text": "Your approval request was {{1}}.\nType: {{2}}, Amount: Rs. {{3}}.\nView: {{4}}",
      "example": {
        "body_text": [["approved", "diesel_purchase", "12,50,000", "https://approve.agri.feerasta.ai/abc"]]
      }
    },
    {
      "type": "BUTTONS",
      "buttons": [
        { "type": "URL", "text": "View details", "url": "https://approve.agri.feerasta.ai/{{1}}", "example": ["https://approve.agri.feerasta.ai/abc"] }
      ]
    }
  ]
}'

echo "Registering zameen_escalation_reminder"
post '{
  "name": "zameen_escalation_reminder",
  "language": "en",
  "category": "UTILITY",
  "components": [
    {
      "type": "BODY",
      "text": "Reminder: pending approval is {{1}}h old.\nType: {{2}}, Amount: Rs. {{3}}.\nTap to review: {{4}}",
      "example": {
        "body_text": [["27", "repair_quote", "85,000", "https://approve.agri.feerasta.ai/abc"]]
      }
    },
    {
      "type": "BUTTONS",
      "buttons": [
        { "type": "URL", "text": "Review now", "url": "https://approve.agri.feerasta.ai/{{1}}", "example": ["https://approve.agri.feerasta.ai/abc"] }
      ]
    }
  ]
}'

echo "Registering zameen_otp"
post '{
  "name": "zameen_otp",
  "language": "en",
  "category": "AUTHENTICATION",
  "components": [
    { "type": "BODY", "text": "Your Zameen login code is {{1}}. Do not share it.", "example": { "body_text": [["482193"]] } }
  ]
}'

echo "Done. Templates will appear in Pending status until Meta review (24-48h)."
