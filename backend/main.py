"""FastAPI application – REST endpoints + WebSocket for TriageFlow."""

import asyncio
import json
import os
import time
import math
from contextlib import asynccontextmanager
from typing import Any, Dict, List
from dotenv import load_dotenv
from datetime import datetime
import urllib.request
import urllib.error

load_dotenv()

SCORING_INTERVAL = int(os.getenv("SCORING_INTERVAL", "5"))
CORS_ORIGIN = os.getenv("CORS_ORIGIN", "http://localhost:5173")
FIREBASE_HOSTING_ORIGIN = os.getenv("FIREBASE_HOSTING_ORIGIN", "").strip()
START_TIME = time.time()

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from firebase_config import initialize_firebase
from models import HistoryEntry, Incident
from simulator import Simulator
from state import get_store

# ---------------------------------------------------------------------------
# Weather cache (Open-Meteo)
# ---------------------------------------------------------------------------

_weather_cache: Dict[str, Any] = {"rain_mm": 0.0, "updated_at": None}


async def refresh_weather() -> None:
    """Refresh rainfall (mm/hr) for Bengaluru via Open-Meteo."""
    url = (
        "https://api.open-meteo.com/v1/forecast?"
        "latitude=12.9716&longitude=77.5946&hourly=precipitation&forecast_days=1&timezone=Asia%2FKolkata"
    )
    try:
        def _fetch() -> Dict[str, Any]:
            with urllib.request.urlopen(url, timeout=6) as resp:
                return json.loads(resp.read().decode("utf-8"))

        data = await asyncio.to_thread(_fetch)
        hourly = data.get("hourly") or {}
        times = hourly.get("time") or []
        precip = hourly.get("precipitation") or []
        now_key = datetime.now().strftime("%Y-%m-%dT%H:00")
        idx = times.index(now_key) if now_key in times else None
        if idx is None or idx >= len(precip):
            return
        rain_mm = float(precip[idx] or 0.0)
        _weather_cache["rain_mm"] = rain_mm
        _weather_cache["updated_at"] = datetime.now().isoformat()
        # Plumb into in-memory store for scoring multiplier
        try:
            get_store().weather_rain_mm = rain_mm
        except Exception:
            pass
    except Exception:
        # Keep previous value on failures
        return


async def _weather_loop() -> None:
    # Run immediately on startup, then every 10 minutes
    await refresh_weather()
    while True:
        await asyncio.sleep(600)
        await refresh_weather()


# ---------------------------------------------------------------------------
# Optimization engine
# ---------------------------------------------------------------------------

def compute_optimization(zones: List[Dict[str, Any]] | List[Any], units: List[Dict[str, Any]] | List[Any]) -> Dict[str, Any]:
    def _get(obj: Any, key: str, default: Any = None) -> Any:
        return getattr(obj, key, obj.get(key, default) if isinstance(obj, dict) else default)

    zone_rows = []
    for z in zones or []:
        zid = int(_get(z, "id", 0) or 0)
        status = str(_get(z, "status", "green"))
        pressure = float(_get(z, "pressure_score", 0.0) or 0.0)
        score = pressure * (1.5 if status == "red" else 1.0)
        zone_rows.append({
            "zone_id": zid,
            "zone_name": str(_get(z, "name", f"Zone {zid}")),
            "status": status,
            "pressure_score": pressure,
            "score": score,
        })

    zone_rows.sort(key=lambda r: r["score"], reverse=True)

    total_available = sum(1 for u in (units or []) if str(_get(u, "status", "")) == "available")

    current_count: Dict[int, int] = {}
    for u in units or []:
        if str(_get(u, "status", "")) != "available":
            continue
        zid = int(_get(u, "zone_id", 0) or 0)
        current_count[zid] = current_count.get(zid, 0) + 1

    n_zones = max(1, len(zone_rows))
    n_top = max(1, int(math.ceil(n_zones * 0.25)))
    top_ids = {r["zone_id"] for r in zone_rows[:n_top]}

    # Distribute recommended units
    recommended: Dict[int, int] = {r["zone_id"]: 1 for r in zone_rows}  # minimum 1 each
    if total_available > 0:
        top_pool = int(math.ceil(total_available * 0.5))
        rest_pool = max(0, total_available - top_pool)

        per_top = int(math.ceil(top_pool / max(1, n_top)))
        for zid in top_ids:
            recommended[zid] = max(1, per_top)

        remaining_zones = [r["zone_id"] for r in zone_rows if r["zone_id"] not in top_ids]
        if remaining_zones:
            per_rest = int(math.ceil(rest_pool / len(remaining_zones))) if rest_pool > 0 else 0
            for zid in remaining_zones:
                recommended[zid] = max(recommended.get(zid, 1), max(1, per_rest) if rest_pool > 0 else 1)

        # Cap total recommended at total_available (reduce from lowest priority)
        total_rec = sum(recommended.values())
        if total_rec > total_available:
            overflow = total_rec - total_available
            for r in reversed(zone_rows):  # lowest scores first
                if overflow <= 0:
                    break
                zid = r["zone_id"]
                if recommended.get(zid, 1) > 1:
                    take = min(overflow, recommended[zid] - 1)
                    recommended[zid] -= take
                    overflow -= take

    scores = [r["score"] for r in zone_rows] or [0.0]
    smin, smax = min(scores), max(scores)
    denom = (smax - smin) if (smax - smin) != 0 else 1.0

    allocation_plan = []
    deltas = []
    for r in zone_rows:
        zid = r["zone_id"]
        cur = int(current_count.get(zid, 0))
        rec = int(recommended.get(zid, 1))
        delta = rec - cur
        deltas.append(abs(delta))
        priority = ((r["score"] - smin) / denom) * 100.0
        allocation_plan.append({
            "zone_id": zid,
            "zone_name": r["zone_name"],
            "current_units": cur,
            "recommended_units": rec,
            "delta": delta,
            "priority_score": round(float(priority), 1),
        })

    mean_abs_delta = (sum(deltas) / len(deltas)) if deltas else 0.0
    optimization_score = max(0.0, min(100.0, 100.0 - mean_abs_delta * 5.0))

    return {
        "allocation_plan": allocation_plan,
        "optimization_score": round(float(optimization_score), 1),
        "total_available_units": int(total_available),
        "shortage": bool(total_available < 3),
    }

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
    weather_task = asyncio.create_task(_weather_loop())
    yield
    if task is not None:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
    weather_task.cancel()
    try:
        await weather_task
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

@app.get("/weather")
def get_weather():
    try:
        return {
            "rain_mm": float(_weather_cache.get("rain_mm") or 0.0),
            "updated_at": _weather_cache.get("updated_at"),
        }
    except Exception as e:
        print(f"Error in /weather: {e}")
        return JSONResponse(status_code=500, content={"error": "Internal Server Error"})

@app.get("/optimize")
def optimize():
    try:
        state = get_store().get_state()
        payload = compute_optimization(state.zones, state.units)
        return {
            "allocation_plan": payload["allocation_plan"],
            "optimization_score": payload["optimization_score"],
            "total_available_units": payload["total_available_units"],
            "shortage": payload["shortage"],
        }
    except Exception as e:
        print(f"Error in /optimize: {e}")
        return JSONResponse(status_code=500, content={"error": "Internal Server Error"})

@app.get("/predict/{zone_id}")
def predict(zone_id: int):
    try:
        points: List[HistoryEntry] = get_store().get_history(zone_id)[-12:]
        if not points:
            return {
                "zone_id": zone_id,
                "predicted": [],
                "surge_expected": False,
                "surge_at_minutes": None,
            }
        y = [float(p.pressure_score) for p in points]
        n = len(y)
        x = list(range(n))
        sum_x = sum(x)
        sum_y = sum(y)
        sum_x2 = sum(i * i for i in x)
        sum_xy = sum(x[i] * y[i] for i in range(n))
        denom = (n * sum_x2 - sum_x * sum_x)
        slope = ((n * sum_xy - sum_x * sum_y) / denom) if denom != 0 else 0.0
        intercept = (sum_y - slope * sum_x) / n if n else 0.0

        predicted = []
        surge_expected = False
        surge_at_minutes = None
        for i in range(1, 13):
            val = intercept + slope * (n + i)
            val = min(100.0, max(0.0, float(val)))
            minutes = i * 5
            predicted.append({"minutes_ahead": minutes, "predicted_score": round(val, 2)})
            if (not surge_expected) and i <= 6 and val > 75:
                surge_expected = True
                surge_at_minutes = minutes

        return {
            "zone_id": zone_id,
            "predicted": predicted,
            "surge_expected": surge_expected,
            "surge_at_minutes": surge_at_minutes,
        }
    except Exception as e:
        print(f"Error in /predict: {e}")
        return JSONResponse(status_code=500, content={"error": "Internal Server Error"})

@app.get("/impact")
def impact():
    try:
        accepted = int(get_store().accepted_count)
        return {
            "minutes_saved": accepted * 7,
            "lives_impacted": accepted * 7 * 12,
            "optimization_sessions": accepted,
            "co2_avoided_kg": round(accepted * 2.3, 1),
        }
    except Exception as e:
        print(f"Error in /impact: {e}")
        return JSONResponse(status_code=500, content={"error": "Internal Server Error"})

@app.post("/mutual-aid")
def mutual_aid(payload: Dict[str, Any]):
    try:
        requesting_zone_id = int(payload.get("requesting_zone_id", 1))
        units_needed = int(payload.get("units_needed", 1))
        # Synthetic incident log entry
        get_store().add_incident(Incident(
            id=f"mutual_aid_{int(time.time())}",
            zone_id=requesting_zone_id,
            type="mutual_aid_request",
            severity="high",
            timestamp=datetime.now().isoformat(),
            description=f"Mutual aid requested for zone {requesting_zone_id} ({units_needed} units needed).",
        ))
        return {"status": "requested", "eta_minutes": 15, "responding_district": "Tumkur"}
    except Exception as e:
        print(f"Error in /mutual-aid: {e}")
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
    """Trigger flood scenario from a clean baseline each time."""
    try:
        sim: Simulator = app.state.sim
        # Always start from a known clean state so each demo run is deterministic.
        sim.stop_flood()
        get_store().reset()
        get_store().run_scoring_pass()
        sim.start_flood()
        return {"status": "flood_started", "message": "Flood scenario activated from green baseline."}
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


@app.post("/chat")
async def chat(payload: Dict[str, Any]):
    """AI assistant endpoint — routes question + context through Gemini."""
    try:
        question = str(payload.get("question", "")).strip()
        context = payload.get("context", {})
        if not question:
            return JSONResponse(status_code=400, content={"error": "question is required"})

        gemini_key = os.getenv("GEMINI_API_KEY", "").strip()
        gemini_model = os.getenv("GEMINI_MODEL", "gemini-1.5-flash-latest").strip()

        system_context = (
            f"You are TriageFlow AI, an emergency command assistant for Bengaluru flood response. "
            f"Current situation: {context.get('critical', 0)} zones critical (red), "
            f"{context.get('amber', 0)} zones at risk (amber), "
            f"{context.get('pending', 0)} pending AI suggestions, "
            f"{context.get('available_units', 0)} units available, "
            f"rainfall {context.get('rain_mm', 0)} mm/hr, "
            f"top critical zones: {context.get('top_critical', 'none')}. "
            "Be concise (max 3 sentences), actionable, and prioritize life safety. "
            "Speak like an experienced emergency dispatcher."
        )
        prompt = f"{system_context}\n\nOperator question: {question}"

        def _rule_based_reply(user_question: str, ctx: Dict[str, Any], gemini_failed: bool = False) -> str:
            critical = int(ctx.get("critical", 0) or 0)
            amber = int(ctx.get("amber", 0) or 0)
            pending = int(ctx.get("pending", 0) or 0)
            available = int(ctx.get("available_units", 0) or 0)
            rain_mm = float(ctx.get("rain_mm", 0) or 0)
            top = str(ctx.get("top_critical", "none") or "none")
            q = user_question.lower()

            if "urgent" in q or "critical" in q or "priority" in q:
                if critical > 0:
                    base = (
                        f"Most urgent: {top} with {critical} red zone(s). "
                        f"Accept {pending} pending suggestion(s) now and dispatch nearest units first. "
                        "Stabilize red zones before reallocating to amber zones."
                    )
                elif amber > 0:
                    base = (
                        f"No red zones; {amber} amber zone(s) are at risk. "
                        "Pre-position units and keep one reserve cluster for spillover. "
                        "Monitor changes every scoring tick."
                    )
                else:
                    base = "No urgent hotspot currently. Keep reserve units available and watch rainfall-triggered spikes."
            elif "optimiz" in q or "deploy" in q or "allocation" in q:
                base = (
                    f"Suggested allocation: deploy up to {min(max(2, pending), max(2, available // 2))} units immediately, "
                    "starting with the highest-pressure zone and then adjacent amber zones. "
                    "Keep at least 30% units in reserve for new incidents."
                )
            elif "weather" in q or "rain" in q or "flood" in q:
                if rain_mm >= 20:
                    base = (
                        f"Rainfall is high at {rain_mm:.1f} mm/hr; flood risk is elevated. "
                        "Pre-stage rescue units near low-lying zones and reduce response radius. "
                        "Expect incident density to rise in adjacent zones."
                    )
                elif rain_mm >= 5:
                    base = (
                        f"Moderate rain at {rain_mm:.1f} mm/hr. "
                        "Increase monitoring cadence and pre-warn high-traffic zones. "
                        "Keep ambulances distributed across north/south corridors."
                    )
                else:
                    base = (
                        f"Rainfall is low at {rain_mm:.1f} mm/hr. "
                        "Weather pressure is limited; prioritize operational bottlenecks like ER wait and unit imbalance."
                    )
            elif "summar" in q or "status" in q or "situation" in q:
                base = (
                    f"Current status: {critical} red, {amber} amber, {pending} pending suggestions, {available} units available. "
                    f"Top critical zones: {top}. "
                    "Immediate focus: clear pending actions and stabilize red zones first."
                )
            else:
                base = (
                    f"Situation now: {critical} red / {amber} amber zones, {pending} pending suggestions, {available} available units. "
                    "Ask me for priority, optimization, weather risk, or a short incident summary."
                )

            if gemini_failed:
                return f"{base} Gemini response unavailable, so this is a live rule-based answer."
            return base

        if not gemini_key:
            return {"reply": _rule_based_reply(question, context)}

        request_body = json.dumps({
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.25, "maxOutputTokens": 150},
        }).encode("utf-8")

        models_to_try = [gemini_model, "gemini-1.5-flash", "gemini-2.0-flash"]
        reply = ""
        for model_name in models_to_try:
            url = (
                f"https://generativelanguage.googleapis.com/v1beta/models/"
                f"{model_name}:generateContent?key={gemini_key}"
            )
            req = urllib.request.Request(
                url=url, data=request_body, method="POST",
                headers={"Content-Type": "application/json"},
            )
            try:
                def _do_fetch():
                    with urllib.request.urlopen(req, timeout=8) as resp:
                        return json.loads(resp.read().decode("utf-8"))

                body = await asyncio.to_thread(_do_fetch)
                reply = (
                    body.get("candidates", [{}])[0]
                    .get("content", {})
                    .get("parts", [{}])[0]
                    .get("text", "")
                    .strip()
                )
                if reply:
                    break
            except Exception as e:
                print(f"Gemini chat error ({model_name}): {e}")
                continue

        if not reply:
            reply = _rule_based_reply(question, context, gemini_failed=True)

        return {"reply": reply}
    except Exception as e:
        print(f"Error in /chat: {e}")
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
