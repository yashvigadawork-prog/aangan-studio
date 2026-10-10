#!/bin/bash
# Copies a full Vaani address (with your secret) to the clipboard. Usage: scripts/copy-url.sh slots|book|check|webhook
cd "$(dirname "$0")/.." || exit 1
BASE="${BASE_URL:-https://aangan-studio-eight.vercel.app}"
S=$(grep '^WEBHOOK_SECRET=' .env | cut -d= -f2-)
case "$1" in
  slots)   P="/api/slots" ;;
  book)    P="/api/book" ;;
  check)   P="/api/check_lead" ;;
  webhook) P="/api/webhook/vaani" ;;
  *) echo "Usage: $0 slots|book|check|webhook"; exit 1 ;;
esac
printf "%s%s?secret=%s" "$BASE" "$P" "$S" | tr -d '\n' | pbcopy
echo "Copied the $1 address to your clipboard."
