# TriageFlow

TriageFlow is a live emergency command dashboard that predicts pressure before a district fails.
Live demo: [https://your-live-demo-url.web.app](https://your-live-demo-url.web.app)

## The problem
Emergency operations teams usually react after crisis signals become obvious, when response options are already shrinking. During fast events like flooding, dispatch pressure spreads across nearby districts in minutes, and manual coordination cannot keep up with that speed. Teams need a single view that predicts where stress is rising and suggests actions before breakdown happens.

## The solution
TriageFlow combines live zone signals, pressure scoring, and automated resource suggestions in one real-time interface. It continuously monitors all districts, highlights escalation risk, and recommends unit movement when a zone crosses into critical state. The system also includes a deterministic flood simulation so demo runs are consistent and repeatable under pressure.

## How it works
TriageFlow runs in five simple layers:
1. Signal layer: every zone has live operational signals like ER wait changes, ambulance availability, volunteer availability, and crowd pressure.
2. Scoring layer: the backend scores each zone every cycle and classifies it as green, amber, or red.
3. Decision layer: when a zone escalates, the system generates suggested actions and tracks operator accept/dismiss decisions.
4. Simulation layer: a scripted flood scenario drives realistic escalation events so behavior can be tested repeatedly.
5. Presentation layer: the frontend shows the map, incidents, unit movement, suggestions, and impact analytics in real time.

## Quick start
```bash
./start.sh
```

## Run commands
```bash
# Start backend + frontend
./start.sh

# Reset and trigger flood scenario
./demo.sh

# Pre-demo reliability check
./check.sh
```

```bash
# Frontend only (dev)
cd frontend
npm install
npm run dev
```

```bash
# Backend only (dev)
pip install -r requirements.txt
cd backend
python train.py
uvicorn main:app --reload --port 8000
```

```bash
# Autodemo recording mode (no manual input)
# http://localhost:5173/?autodemo=true&demo=true
```

## Deployment
- Backend (Cloud Run): build and deploy with `cloudbuild.yaml`.
- Frontend (Firebase Hosting): run `npm run build` in `frontend/`, then deploy `frontend/dist` with Firebase Hosting.
- Configure frontend env vars (`VITE_API_BASE_URL`, `VITE_WS_URL`) to point to your Cloud Run URL.

## Demo
Run the flood scenario and watch Zone 12 (Floodplain) move from early stress to critical red while adjacent zones lose capacity. You can see the timeline of resource depletion, volunteer drop, and incident reports unfold in a deterministic sequence. This demonstrates that TriageFlow does not just visualize events, it predicts pressure and recommends response actions before full collapse.

## Why it's different
- It is predictive, not reactive: the system scores and warns before operators manually detect full failure.
- It is operator-ready: explainable suggestions and one-key controls make live decisions faster.
- It is demo-proof: deterministic simulation, fallback scoring, health checks, and startup scripts keep the presentation stable.
