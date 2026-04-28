"""FastAPI application – REST endpoints + WebSocket for TriageFlow."""

import asyncio
import json
import os
import time
from contextlib import asynccontextmanager
from typing import Any, Dict, List
from dotenv import load_dotenv

load_dotenv()

SCORING_INTERVAL = int(os.getenv("SCORING_INTERVAL", "5"))
CORS_ORIGIN = os.getenv("CORS_ORIGIN", "http://localhost:5173")
FIREBASE_HOSTING_ORIGIN = os.getenv("FIREBASE_HOSTING_ORIGIN", "").strip()
START_TIME = time.time()

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from firebase_config import initialize_firebase
from models import HistoryEntry
from simulator import Simulator
from state import get_store

# ---------------------------------------------------------------------------
# WebSocket connection manager
# ---------------------------------------------------------------------------


class ConnectionManager:
    def __init__(self) -> None:
        self.active: List[WebSocket] = []

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket) -> None:
        if ws in self.active:
            self.active.remove(ws)

    async def broadcast(self, data: str) -> None:
        stale: List[WebSocket] = []
        for ws in self.active:
            try:
                await ws.send_text(data)
            except Exception:
                stale.append(ws)
        for ws in stale:
            self.disconnect(ws)


manager = ConnectionManager()
feedback_entries: List[Dict[str, Any]] = []


def _aggregate_feedback() -> Dict[str, Any]:
    if not feedback_entries:
        return {
            "total_testers": 0,
            "trust_yes_percent": 0,
            "flood_warning_ratings": {},
            "trust_distribution": {},
            "confusion_distribution": {},
        }

    rating_counts: Dict[str, int] = {}
    trust_counts: Dict[str, int] = {}
    confusion_counts: Dict[str, int] = {}
    trust_yes = 0

    for item in feedback_entries:
        rating = str(item.get("flood_warning_clarity", ""))
        trust = str(item.get("trust_level", ""))
        confusion = str(item.get("confused_most", ""))
        rating_counts[rating] = rating_counts.get(rating, 0) + 1
        trust_counts[trust] = trust_counts.get(trust, 0) + 1
        confusion_counts[confusion] = confusion_counts.get(confusion, 0) + 1
        if trust.lower() == "yes":
            trust_yes += 1

    total = len(feedback_entries)
    return {
        "total_testers": total,
        "trust_yes_percent": round((trust_yes / total) * 100),
        "flood_warning_ratings": rating_counts,
        "trust_distribution": trust_counts,
        "confusion_distribution": confusion_counts,
    }


# ---------------------------------------------------------------------------
# Background loop – ticks every 5 seconds
# ---------------------------------------------------------------------------

async def _simulation_loop(sim: Simulator | None) -> None:
    while True:
        try:
            await asyncio.sleep(SCORING_INTERVAL)
            if sim is None:
                continue
            sim.tick()
            state = sim.store.get_state()
            payload = state.model_dump_json()
            await manager.broadcast(payload)
        except Exception as e:
            print(f"Error in simulation loop: {e}")


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    sim = None
    try:
        initialize_firebase()
        store = get_store()
        sim = Simulator(store)
        app.state.sim = sim
        # Run an initial scoring pass so first GET /state has scores.
        # If this fails, keep the server alive for demo resilience.
        try:
            store.run_scoring_pass()
        except Exception as e:
            print(f"Startup scoring pass failed: {e}")
    except Exception as e:
        print(f"Lifespan initialization error: {e}")
    task = asyncio.create_task(_simulation_loop(sim)) if sim is not None else None
    yield
    if task is not None:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="TriageFlow API",
    version="0.1.0",
    lifespan=lifespan,
)

allowed_origins = [origin.strip() for origin in CORS_ORIGIN.split(",") if origin.strip()]
if FIREBASE_HOSTING_ORIGIN and FIREBASE_HOSTING_ORIGIN not in allowed_origins:
    allowed_origins.append(FIREBASE_HOSTING_ORIGIN)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
def health_check():
    try:
        return {
            "status": "ok",
            "zones_active": len(get_store().zones),
            "scoring_loop": "running",
            "uptime_seconds": int(time.time() - START_TIME)
        }
    except Exception as e:
        print(f"Error in /health: {e}")
        return JSONResponse(status_code=500, content={"error": "Internal Server Error"})


@app.get("/state")
def get_state():
    """Full current state: zones, units, pending suggestions, recent incidents."""
    try:
        return get_store().get_state()
    except Exception as e:
        print(f"Error in /state: {e}")
        return JSONResponse(status_code=500, content={"error": "Internal Server Error"})


@app.get("/history/{zone_id}")
def get_history(zone_id: int):
    """30-minute pressure-score history for a single zone."""
    try:
        entries = get_store().get_history(zone_id)
        return [e.model_dump() for e in entries]
    except Exception as e:
        print(f"Error in /history: {e}")
        return JSONResponse(status_code=500, content={"error": "Internal Server Error"})


@app.post("/simulate/flood")
def simulate_flood():
    """Trigger the flood scenario (gradual spike over 3–4 min)."""
    try:
        sim: Simulator = app.state.sim
        sim.start_flood()
        return {"status": "flood_started", "message": "Flood scenario activated – Zone 12 will escalate over 3-4 minutes."}
    except Exception as e:
        print(f"Error in /simulate/flood: {e}")
        return JSONResponse(status_code=500, content={"error": "Internal Server Error"})


@app.post("/simulate/reset")
def simulate_reset():
    """Reset simulation to baseline."""
    try:
        sim: Simulator = app.state.sim
        sim.stop_flood()
        get_store().reset()
        return {"status": "reset", "message": "Simulation reset to baseline."}
    except Exception as e:
        print(f"Error in /simulate/reset: {e}")
        return JSONResponse(status_code=500, content={"error": "Internal Server Error"})


@app.post("/suggestions/{suggestion_id}/accept")
def accept_suggestion(suggestion_id: str):
    try:
        result = get_store().accept_suggestion(suggestion_id)
        if result is None:
            return JSONResponse(status_code=404, content={"error": "Suggestion not found or already handled"})
        return {"status": "accepted", "suggestion": result.model_dump()}
    except Exception as e:
        print(f"Error in accept_suggestion: {e}")
        return JSONResponse(status_code=500, content={"error": "Internal Server Error"})


@app.post("/suggestions/{suggestion_id}/dismiss")
def dismiss_suggestion(suggestion_id: str):
    try:
        result = get_store().dismiss_suggestion(suggestion_id)
        if result is None:
            return JSONResponse(status_code=404, content={"error": "Suggestion not found or already handled"})
        return {"status": "dismissed", "suggestion": result.model_dump()}
    except Exception as e:
        print(f"Error in dismiss_suggestion: {e}")
        return JSONResponse(status_code=500, content={"error": "Internal Server Error"})


@app.get("/audit")
def get_audit_log():
    """Audit log of accepted and dismissed suggestions."""
    try:
        return get_store().audit_log
    except Exception as e:
        print(f"Error in /audit: {e}")
        return JSONResponse(status_code=500, content={"error": "Internal Server Error"})


@app.post("/feedback")
def submit_feedback(payload: Dict[str, Any]):
    try:
        required = {"session_id", "flood_warning_clarity", "trust_level", "confused_most"}
        if not required.issubset(payload.keys()):
            return JSONResponse(status_code=400, content={"error": "Missing required feedback fields"})

        session_id = str(payload.get("session_id", "")).strip()
        if not session_id:
            return JSONResponse(status_code=400, content={"error": "Invalid session_id"})

        filtered = [
            item for item in feedback_entries
            if str(item.get("session_id", "")).strip() != session_id
        ]
        filtered.append({
            "session_id": session_id,
            "flood_warning_clarity": payload.get("flood_warning_clarity"),
            "trust_level": payload.get("trust_level"),
            "confused_most": payload.get("confused_most"),
            "timestamp": int(time.time()),
        })
        feedback_entries.clear()
        feedback_entries.extend(filtered)
        return {"status": "saved"}
    except Exception as e:
        print(f"Error in /feedback POST: {e}")
        return JSONResponse(status_code=500, content={"error": "Internal Server Error"})


@app.get("/feedback")
def get_feedback():
    try:
        return _aggregate_feedback()
    except Exception as e:
        print(f"Error in /feedback GET: {e}")
        return JSONResponse(status_code=500, content={"error": "Internal Server Error"})


# ---------------------------------------------------------------------------
# WebSocket
# ---------------------------------------------------------------------------

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    try:
        await manager.connect(ws)
        # Keep connection alive; client can send pings
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(ws)
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(ws)
