#!/bin/bash
cd backend && pip install -r ../requirements.txt -q && python train.py && uvicorn main:app --reload --port 8000 &
cd ../frontend && npm install -q && npm run dev &
echo "TriageFlow running. Backend: http://localhost:8000 | Frontend: http://localhost:5173"
wait
