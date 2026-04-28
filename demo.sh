#!/bin/bash
echo "Resetting simulation..."
curl -X POST http://localhost:8000/simulate/reset
sleep 3
echo "Starting flood scenario..."
curl -X POST http://localhost:8000/simulate/flood
echo "Demo active. Watch Bellandur (Zone 7) escalate over the next 4 minutes."
