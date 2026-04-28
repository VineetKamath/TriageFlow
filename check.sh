#!/bin/bash
set -u

BASE_URL="http://localhost:8000"
FAILURES=()

record_failure() {
  FAILURES+=("$1")
}

echo "Checking /health..."
HEALTH_JSON=$(curl -s --max-time 10 "${BASE_URL}/health")
if [[ -z "${HEALTH_JSON}" ]]; then
  record_failure "/health did not respond"
else
  HEALTH_STATUS=$(python -c "import json,sys; print(json.loads(sys.argv[1]).get('status',''))" "${HEALTH_JSON}" 2>/dev/null)
  if [[ "${HEALTH_STATUS}" != "ok" ]]; then
    record_failure "/health status is not ok"
  fi
fi

echo "Checking WebSocket connectivity..."
WS_RESULT=$(python - <<'PY'
import asyncio
import websockets

async def main():
    try:
        async with websockets.connect("ws://localhost:8000/ws", open_timeout=8, ping_interval=None) as ws:
            await ws.send("ping")
            print("WS_OK")
    except Exception:
        print("WS_FAIL")

asyncio.run(main())
PY
)
if [[ "${WS_RESULT}" != *"WS_OK"* ]]; then
  record_failure "WebSocket did not connect"
fi

echo "Resetting and running flood scenario..."
curl -s -X POST "${BASE_URL}/simulate/reset" >/dev/null || record_failure "Could not reset simulation"
sleep 1
curl -s -X POST "${BASE_URL}/simulate/flood" >/dev/null || record_failure "Could not start flood scenario"

echo "Waiting for Zone 12 (Floodplain) to hit red (max 240s)..."
ZONE_RED=0
for _ in $(seq 1 80); do
  STATE_JSON=$(curl -s --max-time 10 "${BASE_URL}/state")
  if [[ -n "${STATE_JSON}" ]]; then
    CHECK_RESULT=$(python -c "import json,sys; data=json.loads(sys.argv[1]); z=next((x for x in data.get('zones',[]) if x.get('id')==12),{}); print('RED' if z.get('status')=='red' and z.get('name')=='Floodplain' else 'WAIT')" "${STATE_JSON}" 2>/dev/null)
    if [[ "${CHECK_RESULT}" == "RED" ]]; then
      ZONE_RED=1
      break
    fi
  fi
  sleep 3
done

if [[ ${ZONE_RED} -ne 1 ]]; then
  record_failure "Zone 12 did not reach red within 4 minutes as Floodplain"
fi

if [[ ${#FAILURES[@]} -eq 0 ]]; then
  echo "DEMO READY"
  exit 0
fi

echo "Demo checks failed:"
for item in "${FAILURES[@]}"; do
  echo "- ${item}"
done
exit 1
