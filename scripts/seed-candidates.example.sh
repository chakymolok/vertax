#!/bin/bash
set -e

BASE="${BASE:-https://vertax-one.vercel.app}"
: "${ADMIN_TOKEN:?Set ADMIN_TOKEN in your shell before running this script}"

MODE="${MODE:-label}"
OFFSET="${OFFSET:-0}"
LIMIT="${LIMIT:-20}"

if [ "$MODE" = "release_ids" ]; then
  : "${RELEASE_IDS:?Set RELEASE_IDS as a comma-separated list, e.g. RELEASE_IDS=123,456}"
  curl -s -X POST "$BASE/api/admin/maintenance" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"action\":\"seed_candidates\",\"release_ids\":[$RELEASE_IDS],\"offset\":$OFFSET,\"limit\":$LIMIT}" \
    | jq '{mode, total, offset, limit, processed_in_batch, saved, updated, failed, next_offset, has_more, errors}'
  exit 0
fi

: "${LABEL_ID:?Set LABEL_ID before running label mode}"

while true; do
  echo "Seeding label $LABEL_ID from offset $OFFSET..."

  RESULT=$(curl -s -X POST "$BASE/api/admin/maintenance" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"action\":\"seed_candidates\",\"label_id\":$LABEL_ID,\"offset\":$OFFSET,\"limit\":$LIMIT}")

  echo "$RESULT" | jq '{total, offset, limit, processed_in_batch, saved, updated, failed, next_offset, has_more, errors}'

  HAS_MORE=$(echo "$RESULT" | jq -r '.has_more')
  NEXT_OFFSET=$(echo "$RESULT" | jq -r '.next_offset')

  if [ "$HAS_MORE" != "true" ]; then
    echo "Seed complete."
    break
  fi

  if [ "$NEXT_OFFSET" = "null" ] || [ -z "$NEXT_OFFSET" ]; then
    echo "No next_offset returned, stopping."
    exit 1
  fi

  OFFSET=$NEXT_OFFSET
  sleep 2
done
