#!/bin/bash
# ── AI Bill Classification ─────────────────────────────────────────────────────
# Sends unclassified K25 bills to Claude in batches of 20.
# Run once to classify all ~7,296 K25 bills (~$1-2 in API cost, ~1 hour).
# Safe to interrupt and resume — picks up where it left off.
#
# Usage: bash scripts/classify.sh

HOST="${HOST:-http://localhost:3000}"
SECRET="${SYNC_SECRET:-727843a44dee65376f3af563d9becedec73ca899079701f93b3cc4dd4979577e}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Knesset Watch — AI Bill Classification"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Show starting progress
echo ""
echo "Starting progress:"
curl -s "${HOST}/api/classify" -H "Authorization: Bearer ${SECRET}" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  {d[\"classified\"]}/{d[\"total\"]} classified ({d[\"pct\"]}%)')" 2>/dev/null

echo ""
echo "▶ Classifying K25 bills (20 per batch, loops until done)..."
echo "  Press Ctrl+C to pause — safe to resume later."
echo ""

iteration=0
while true; do
  iteration=$((iteration + 1))
  result=$(curl -s -X POST "${HOST}/api/classify?knesset=25" \
    -H "Authorization: Bearer ${SECRET}")

  classified=$(echo "$result" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('classified',0))" 2>/dev/null)
  echo "  [batch $iteration] classified ${classified} bills — $result"

  done=$(echo "$result" | grep -o '"done":true')
  if [ -n "$done" ]; then
    echo ""
    echo "  ✓ All K25 bills classified!"
    break
  fi

  # Small pause to avoid hammering the API
  sleep 1
done

echo ""
echo "Final progress:"
curl -s "${HOST}/api/classify" -H "Authorization: Bearer ${SECRET}" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  {d[\"classified\"]}/{d[\"total\"]} classified ({d[\"pct\"]}%)')" 2>/dev/null

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ Classification complete."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
