#!/bin/bash
set -e

BASE="https://vertax-one.vercel.app"
ADMIN_TOKEN="462f82f9381490ea2e9eb5525a3dbe7da67880cb5bece45cb01da75e1cec3c34"
OFFSET=0
LIMIT=20

while true; do
  echo "Batch starting at offset $OFFSET..."

  RESULT=$(curl -s -X POST "$BASE/api/admin/rebuild?offset=$OFFSET&limit=$LIMIT" \
    -H "Authorization: Bearer $ADMIN_TOKEN")

  echo "$RESULT" | jq '{total, offset, limit, processed_in_batch, updated, failed, skipped_no_match, next_offset, has_more, errors}'

  HAS_MORE=$(echo "$RESULT" | jq -r '.has_more')
  NEXT_OFFSET=$(echo "$RESULT" | jq -r '.next_offset')

  if [ "$HAS_MORE" != "true" ]; then
    echo "Rebuild complete."
    break
  fi

  if [ "$NEXT_OFFSET" = "null" ] || [ -z "$NEXT_OFFSET" ]; then
    echo "No next_offset returned, stopping."
    exit 1
  fi

  OFFSET=$NEXT_OFFSET
  sleep 2
done
