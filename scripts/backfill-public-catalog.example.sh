#!/bin/bash
set -e

BASE="${BASE:-https://vertax.live}"
: "${ADMIN_TOKEN:?Set ADMIN_TOKEN in your shell before running this script}"

LIMIT="${LIMIT:-20}"

while true; do
  echo "Hydrating the next $LIMIT catalog releases..."

  RESULT=$(curl -sS -X POST "$BASE/api/admin/maintenance" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"action\":\"backfill_public_catalog\",\"missing_only\":true,\"limit\":$LIMIT}")

  echo "$RESULT" | jq '{total, missing_before_sync, processed_in_batch, updated, failed, remaining, has_more, errors}'

  HAS_MORE=$(echo "$RESULT" | jq -r '.has_more')

  if [ "$HAS_MORE" != "true" ]; then
    echo "Public catalog backfill complete."
    break
  fi

  sleep 2
done

while true; do
  echo "Enriching the next catalog tracks..."

  RESULT=$(curl -sS -X POST "$BASE/api/admin/maintenance" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"action\":\"enrich_public_catalog\",\"limit\":8}")

  echo "$RESULT" | jq '{queued_before_batch, processed, enriched, partial, missed, failed, remaining, errors}'

  REMAINING=$(echo "$RESULT" | jq -r '.remaining')
  PROCESSED=$(echo "$RESULT" | jq -r '.processed')

  if [ "$REMAINING" = "0" ]; then
    echo "Public catalog metadata enrichment complete."
    break
  fi

  if [ "$PROCESSED" = "0" ] || [ "$PROCESSED" = "null" ]; then
    echo "No tracks were processed, stopping to avoid a tight retry loop."
    exit 1
  fi

  sleep 2
done
