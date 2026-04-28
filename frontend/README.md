# TriageFlow Frontend (React + Vite)

This frontend is the live operations dashboard for TriageFlow.

## Dev setup
```bash
cd frontend
npm install
npm run dev
```

By default it expects the backend at `http://localhost:8000`.

## Environment variables
- `VITE_API_BASE_URL`: REST API base (default `http://localhost:8000`)
- `VITE_WS_URL`: WebSocket URL (default `ws://localhost:8000/ws`)

## Key UI features
- Bengaluru **ward GeoJSON** pressure polygons (Leaflet)
- Animated unit dispatch + status icons
- Optimization summary + panel
- Weather badge + rainfall overlay
- Forecast chart (predictive surge)

## Shortcuts
`F` run flood, `R` reset, `A` accept first suggestion, `C` analysis, `O` optimize, `Esc` close overlays.
