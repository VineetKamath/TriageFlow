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
        self.suggestions: List[Suggestion] = []
        self.incidents: List[Incident] = []
        self.history: Dict[int, deque] = {}
        self.audit_log: List[Dict[str, Any]] = []
        self._load_zones()
        self._create_units()

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
                    er_wait_delta=round(random.uniform(-2, 5), 1),
                    ambulance_count=random.randint(2, 4),
                    volunteer_availability=round(random.uniform(0.5, 0.9), 2),
                    incident_density_adjacent=random.randint(0, 3),
                    crowd_density=round(random.uniform(0.1, 0.4), 2),
                    time_of_day=hour,
                ),
            )
            self.history[zid] = deque(maxlen=MAX_HISTORY)

    def _create_units(self) -> None:
        for i in range(1, 21):
            self.units[i] = Unit(id=i, zone_id=i, status=UnitStatus.available)

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
                # Move the suggested units
                for uid in s.unit_ids:
                    self.move_unit(uid, s.zone_id, UnitStatus.en_route)
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

    def run_scoring_pass(self) -> None:
        """Score every zone, record history, and auto-generate suggestions."""
        zones_data = [
            {"id": z.id, "signals": z.signals.model_dump()}
            for z in self.zones.values()
        ]
        results = score_zones(zones_data)

        now_iso = datetime.now(timezone.utc).isoformat()

        for r in results:
            zid = r["zone_id"]
            old_status = self.zones[zid].status

            self.zones[zid].pressure_score = r["pressure_score"]
            self.zones[zid].status = ZoneStatus(r["status"])
            self.zones[zid].explanation = r["explanation"]
            self.zones[zid].ai_summary = r.get("ai_summary", "")
            write_json(f"/zones/{zid}", self.zones[zid].model_dump())

            # History
            self.history[zid].append(HistoryEntry(
                timestamp=now_iso,
                pressure_score=r["pressure_score"],
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
        for zid in self.history:
            self.history[zid].clear()
        hour = datetime.now().hour
        for z in self.zones.values():
            z.pressure_score = 0.0
            z.status = ZoneStatus.green
            z.explanation = []
            z.ai_summary = ""
            z.signals = ZoneSignals(
                er_wait_delta=round(random.uniform(-2, 5), 1),
                ambulance_count=random.randint(2, 4),
                volunteer_availability=round(random.uniform(0.5, 0.9), 2),
                incident_density_adjacent=random.randint(0, 3),
                crowd_density=round(random.uniform(0.1, 0.4), 2),
                time_of_day=hour,
            )
        for u in self.units.values():
            u.zone_id = u.id
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
