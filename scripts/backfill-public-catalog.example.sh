#!/bin/bash
set -e

BASE="${BASE:-https://vertax.live}"
: "${ADMIN_TOKEN:?Set ADMIN_TOKEN in your shell before running this script}"

OFFSET="${OFFSET:-0}"
LIMIT="${LIMIT:-10}"

while true; do
  echo "Catalog batch starting at offset $OFFSET..."

  RESULT=$(curl -sS -X POST "$BASE/api/admin/maintenance" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"action\":\"backfill_public_catalog\",\"offset\":$OFFSET,\"limit\":$LIMIT}")

  echo "$RESULT" | jq '{total, offset, limit, processed_in_batch, updated, failed, next_offset, has_more, errors}'

  HAS_MORE=$(echo "$RESULT" | jq -r '.has_more')
  NEXT_OFFSET=$(echo "$RESULT" | jq -r '.next_offset')

  if [ "$HAS_MORE" != "true" ]; then
    echo "Public catalog backfill complete."
    break
  fi

  if [ "$NEXT_OFFSET" = "null" ] || [ -z "$NEXT_OFFSET" ]; then
    echo "No next_offset returned, stopping."
    exit 1
  fi

  OFFSET=$NEXT_OFFSET
  sleep 2
done
