"""In-memory state store for TriageFlow."""

import json
import math
import os
import random
import uuid
from collections import deque
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from models import (
    AppState,
    HistoryEntry,
    Incident,
    Suggestion,
    SuggestionStatus,
    Unit,
    UnitStatus,
    Zone,
    ZoneSignals,
    ZoneStatus,
)
from firebase_config import write_json
from scoring import score_zones

MAX_HISTORY = 360  # 30 min at 5-second ticks


class StateStore:
    """Central mutable state – zones, units, suggestions, incidents, history."""

    def __init__(self) -> None:
        self.zones: Dict[int, Zone] = {}
        self.units: Dict[int, Unit] = {}
        self._initial_unit_zone: Dict[int, int] = {}
        self.suggestions: List[Suggestion] = []
        self.incidents: List[Incident] = []
        self.history: Dict[int, deque] = {}
        self.audit_log: List[Dict[str, Any]] = []
        self.accepted_count: int = 0
        self.weather_rain_mm: float = 0.0
        self._load_zones()
        self._create_units()
        self._seed_mock_incidents()

    # ------------------------------------------------------------------
    # Initialisation helpers
    # ------------------------------------------------------------------

    def _load_zones(self) -> None:
        geojson_path = os.path.join(os.path.dirname(__file__), "data", "zones.geojson")
        with open(geojson_path) as f:
            geojson = json.load(f)

        hour = datetime.now().hour
        for feat in geojson["features"]:
            p = feat["properties"]
            zid = p["id"]
            self.zones[zid] = Zone(
                id=zid,
                name=p["name"],
                center_lat=p["center_lat"],
                center_lng=p["center_lng"],
                pressure_score=0.0,
                status=ZoneStatus.green,
                signals=ZoneSignals(
                    # India/Bengaluru-ish baselines (busier peaks, more traffic-driven variance)
                    er_wait_delta=round(random.uniform(-1, 8), 1),
                    ambulance_count=random.randint(2, 6),
                    volunteer_availability=round(random.uniform(0.35, 0.85), 2),
                    incident_density_adjacent=random.randint(0, 6),
                    crowd_density=round(random.uniform(0.15, 0.65), 2),
                    time_of_day=hour,
                ),
            )
            self.history[zid] = deque(maxlen=MAX_HISTORY)

    def _create_units(self) -> None:
        # More units for a large Indian metro (mix of zones)
        zone_ids = list(self.zones.keys())
        for i in range(1, 41):
            assigned_zone = random.choice(zone_ids) if zone_ids else 1
            self.units[i] = Unit(
                id=i,
                zone_id=assigned_zone,
                status=UnitStatus.available,
            )
            self._initial_unit_zone[i] = assigned_zone

    def _seed_mock_incidents(self) -> None:
        """Seed a small set of India-specific incidents for a richer demo on first load."""
        # Keep this deterministic-ish and lightweight.
        samples = [
            (random.choice(list(self.zones.keys())), "Road accident (two-wheeler)", "medium", "Minor injuries reported; congestion building."),
            (random.choice(list(self.zones.keys())), "Waterlogging / underpass flooded", "high", "Slow-moving traffic; stranded vehicles reported."),
            (random.choice(list(self.zones.keys())), "Heat exhaustion", "low", "Dehydration case reported near bus stop."),
            (random.choice(list(self.zones.keys())), "Power transformer fire", "high", "Smoke reported; BESCOM crew requested."),
            (random.choice(list(self.zones.keys())), "Dengue cluster reported", "medium", "Local clinic reports rising fever cases."),
        ]
        for zid, itype, sev, desc in samples:
            self.incidents.append(Incident(
                id=str(uuid.uuid4()),
                zone_id=int(zid),
                type=itype,
                severity=sev,
                timestamp=datetime.now(timezone.utc).isoformat(),
                description=f"{desc} (Bengaluru)"
            ))

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def get_state(self) -> AppState:
        return AppState(
            zones=list(self.zones.values()),
            units=list(self.units.values()),
            suggestions=[s for s in self.suggestions if s.status == SuggestionStatus.pending],
            incidents=self.incidents[-50:],
        )

    def get_history(self, zone_id: int) -> List[HistoryEntry]:
        return list(self.history.get(zone_id, []))

    def update_zone(self, zone_id: int, **kwargs: Any) -> None:
        zone = self.zones.get(zone_id)
        if zone is None:
            return
        for k, v in kwargs.items():
            if k == "signals":
                zone.signals = ZoneSignals(**v) if isinstance(v, dict) else v
            else:
                setattr(zone, k, v)

    def move_unit(self, unit_id: int, target_zone_id: int, status: UnitStatus = UnitStatus.en_route) -> None:
        unit = self.units.get(unit_id)
        if unit:
            unit.zone_id = target_zone_id
            unit.status = status

    def add_suggestion(self, suggestion: Suggestion) -> None:
        self.suggestions.append(suggestion)

    def accept_suggestion(self, suggestion_id: str) -> Optional[Suggestion]:
        for s in self.suggestions:
            if s.id == suggestion_id and s.status == SuggestionStatus.pending:
                s.status = SuggestionStatus.accepted
                self.accepted_count += 1
                # Move the suggested units
                for uid in s.unit_ids:
                    self.move_unit(uid, s.zone_id, UnitStatus.en_route)
                # Strong immediate relief — each accept visibly lowers pressure.
                target = self.zones.get(s.zone_id)
                if target is not None:
                    n = max(1, len(s.unit_ids))
                    drop = 20.0 + (5.0 * n)
                    sig = target.signals
                    target.signals = ZoneSignals(
                        er_wait_delta=max(-3.0, sig.er_wait_delta - drop * 0.6),
                        ambulance_count=min(8, sig.ambulance_count + n + 2),
                        volunteer_availability=min(1.0, round(sig.volunteer_availability + 0.20, 2)),
                        incident_density_adjacent=max(0, sig.incident_density_adjacent - 3),
                        crowd_density=max(0.05, round(sig.crowd_density - 0.20, 2)),
                        time_of_day=sig.time_of_day,
                    )
                    target.pressure_score = max(0.0, target.pressure_score - drop)
                    if target.pressure_score < 40:
                        target.status = ZoneStatus.green
                    elif target.pressure_score < 70:
                        target.status = ZoneStatus.amber
                    else:
                        target.status = ZoneStatus.red
                self.audit_log.append({
                    "suggestion_id": s.id,
                    "action": "accepted",
                    "zone": s.zone_id,
                    "units_moved": len(s.unit_ids),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "pressure_score_at_time": self.zones[s.zone_id].pressure_score if s.zone_id in self.zones else 0
                })
                write_json(f"/audit_log/{s.id}", self.audit_log[-1])
                return s
        return None

    def dismiss_suggestion(self, suggestion_id: str) -> Optional[Suggestion]:
        for s in self.suggestions:
            if s.id == suggestion_id and s.status == SuggestionStatus.pending:
                s.status = SuggestionStatus.dismissed
                self.audit_log.append({
                    "suggestion_id": s.id,
                    "action": "dismissed",
                    "zone": s.zone_id,
                    "units_moved": 0,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "pressure_score_at_time": self.zones[s.zone_id].pressure_score if s.zone_id in self.zones else 0
                })
                return s
        return None

    def add_incident(self, incident: Incident) -> None:
        self.incidents.append(incident)
        write_json(f"/incidents/{incident.id}", incident.model_dump())

    # ------------------------------------------------------------------
    # Scoring + suggestion generation
    # ------------------------------------------------------------------

    def run_scoring_pass(self, skip_zone_ids: set = None) -> None:
        """Score zones, record history, and auto-generate suggestions.

        skip_zone_ids: set of zone ids whose pressure the simulator controls
        directly — they are excluded from ML scoring so the simulator's
        deterministic profile cannot be overwritten.
        """
        skip = skip_zone_ids or set()
        zones_data = [
            {"id": z.id, "signals": z.signals.model_dump()}
            for z in self.zones.values()
            if z.id not in skip
        ]
        if not zones_data:
            return
        results = score_zones(zones_data)

        now_iso = datetime.now(timezone.utc).isoformat()

        for r in results:
            zid = r["zone_id"]
            old_status = self.zones[zid].status

            base_pressure = float(r["pressure_score"])
            rain_mm = float(self.weather_rain_mm or 0.0)
            if rain_mm < 2:
                multiplier = 1.0
            elif rain_mm < 10:
                multiplier = 1.3
            elif rain_mm < 30:
                multiplier = 1.6
            else:
                multiplier = 2.0
            self.zones[zid].pressure_score = min(100.0, base_pressure * multiplier)
            self.zones[zid].status = ZoneStatus(r["status"])
            self.zones[zid].explanation = r["explanation"]
            self.zones[zid].ai_summary = r.get("ai_summary", "")
            write_json(f"/zones/{zid}", self.zones[zid].model_dump())

            # History
            self.history[zid].append(HistoryEntry(
                timestamp=now_iso,
                pressure_score=self.zones[zid].pressure_score,
                status=r["status"],
            ))

            # Suggestion: amber → red transition
            if old_status != ZoneStatus.red and r["status"] == "red":
                self._generate_suggestion(zid, r["explanation"])

    def _generate_suggestion(self, zone_id: int, explanations: List[str]) -> None:
        """Pick 2 nearest available units from green zones and create a suggestion."""
        target = self.zones[zone_id]

        # Collect available units in green zones
        candidates: List[tuple] = []
        for u in self.units.values():
            if u.status != UnitStatus.available:
                continue
            uz = self.zones.get(u.zone_id)
            if uz is None or uz.status != ZoneStatus.green:
                continue
            dist = math.hypot(uz.center_lat - target.center_lat, uz.center_lng - target.center_lng)
            candidates.append((dist, u.id))

        candidates.sort()
        picked = [uid for _, uid in candidates[:2]]
        if not picked:
            return

        self.add_suggestion(Suggestion(
            id=str(uuid.uuid4()),
            zone_id=zone_id,
            unit_ids=picked,
            explanation=explanations,
            created_at=datetime.now(timezone.utc).isoformat(),
        ))

    # ------------------------------------------------------------------
    # Reset to baseline
    # ------------------------------------------------------------------

    def reset(self) -> None:
        self.suggestions.clear()
        self.incidents.clear()
        self.audit_log.clear()
        self.accepted_count = 0
        for zid in self.history:
            self.history[zid].clear()
        hour = datetime.now().hour
        for z in self.zones.values():
            z.pressure_score = 0.0
            z.status = ZoneStatus.green
            z.explanation = []
            z.ai_summary = ""
            z.signals = ZoneSignals(
                # Green-safe baseline so reset visibly returns to nominal city state.
                er_wait_delta=round(random.uniform(-2, 1), 1),
                ambulance_count=random.randint(4, 6),
                volunteer_availability=round(random.uniform(0.7, 0.95), 2),
                incident_density_adjacent=random.randint(0, 1),
                crowd_density=round(random.uniform(0.08, 0.22), 2),
                time_of_day=hour,
            )
        for u in self.units.values():
            u.zone_id = self._initial_unit_zone.get(u.id, random.choice(list(self.zones.keys())))
            u.status = UnitStatus.available


# ---------------------------------------------------------------------------
# Singleton
# ---------------------------------------------------------------------------

_store: StateStore | None = None


def get_store() -> StateStore:
    global _store
    if _store is None:
        _store = StateStore()
    return _store
