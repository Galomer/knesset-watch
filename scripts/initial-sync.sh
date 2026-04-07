#!/bin/bash
# ── Initial historical sync ────────────────────────────────────────────────────
# Run this once to populate the database with all historical data.
# Each step loops until the API confirms it's done.
#
# Usage: bash scripts/initial-sync.sh
# Takes: ~30–60 minutes depending on Knesset API speed.

HOST="${HOST:-http://localhost:3000}"
SECRET="${SYNC_SECRET:-727843a44dee65376f3af563d9becedec73ca899079701f93b3cc4dd4979577e}"

call() {
  curl -s -X POST "${HOST}/api/sync?type=${1}" \
    -H "Authorization: Bearer ${SECRET}"
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Knesset Watch — Initial Historical Sync"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Step 1: All members (current + historical)
echo ""
echo "▶ Step 1/4: Syncing all members (current + historical)..."
result=$(call members-all)
echo "  $result"

# Step 2: ALL K25 bills + initiators (largest step, loops until done)
echo ""
echo "▶ Step 2/4: Syncing all K25 bills (this may take 15–20 min)..."
iteration=0
while true; do
  iteration=$((iteration + 1))
  result=$(call bills-k25)
  echo "  [call $iteration] $result"
  done=$(echo "$result" | grep -o '"done":true')
  if [ -n "$done" ]; then
    echo "  ✓ K25 bills done"
    break
  fi
  sleep 2
done

# Step 3: Historical Knessets K20–K24 (loops until all done)
echo ""
echo "▶ Step 3/4: Syncing historical Knessets K20–K24 (10–20 min)..."
iteration=0
while true; do
  iteration=$((iteration + 1))
  result=$(call bills-historical)
  echo "  [call $iteration] $result"
  all_done=$(echo "$result" | grep -o '"All historical Knessets synced"')
  if [ -n "$all_done" ]; then
    echo "  ✓ Historical Knessets done"
    break
  fi
  sleep 2
done

# Step 4: Final status check
echo ""
echo "▶ Step 4/4: Final database summary..."
curl -s "${HOST}/api/sync" \
  -H "Authorization: Bearer ${SECRET}" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  Members: {d[\"members_in_db\"]}  Bills: {d[\"bills_in_db\"]}')" 2>/dev/null || \
  curl -s "${HOST}/api/sync" -H "Authorization: Bearer ${SECRET}"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ Initial sync complete. Daily cron will keep it updated."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
