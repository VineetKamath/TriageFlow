"""Simulator – tick-based with a deterministic flood scenario."""

import random
import uuid
from datetime import datetime, timezone

from models import Incident, ZoneSignals, ZoneStatus
from state import StateStore

FLOOD_ZONE = 7         # Bellandur (monsoon hotspot)
FLOOD_ADJACENT = [6, 8, 12]  # Marathahalli, Sarjapur Road, BTM Layout

INCIDENT_TYPES = [
    ("Road accident on Outer Ring Road", "high"),
    ("Waterlogging – underpass flooded", "critical"),
    ("Tree collapse near hospital", "medium"),
    ("Power transformer fire", "high"),
    ("Apartment evacuation request", "critical"),
    ("Flood rescue – stranded motorists", "critical"),
]

# ── Pressure profile per tick for the flood zone ──────────────────────────────
# Tick 0 = start_flood called (signals primed, no profile yet)
# Ticks 1..N driven here. SCORING_INTERVAL=5 s → 9 ticks ≈ 45 s total.
#          [t1,  t2,  t3,  t4,  t5,  t6,  t7,  t8,  t9 ]
_FLOOD_P =  [58,  76,  88,  84,  70,  54,  38,  25,  15 ]
_ADJ_P   =  [48,  62,  72,  66,  54,  42,  32,  22,  14 ]  # -4 per adj index

# Signals to apply to flood zone depending on phase
def _make_signals(pressure: float, base_hour: int) -> ZoneSignals:
    t = max(0.0, min(1.0, pressure / 100.0))
    return ZoneSignals(
        er_wait_delta=round(-3.0 + t * 68.0, 1),
        ambulance_count=max(0, int(6 - t * 6)),
        volunteer_availability=round(max(0.05, 0.9 - t * 0.85), 2),
        incident_density_adjacent=int(t * 13),
        crowd_density=round(min(0.97, 0.1 + t * 0.87), 2),
        time_of_day=base_hour,
    )


class Simulator:
    def __init__(self, store: StateStore) -> None:
        self.store = store
        self.flood_active = False
        self.flood_tick = 0

    # ── Normal background fluctuations for non-controlled zones ───────────────
    def _normal_tick(self, skip_ids: set = None) -> None:
        hour = datetime.now().hour
        skip = skip_ids or set()
        for zone in self.store.zones.values():
            if zone.id in skip:
                continue
            s = zone.signals
            zone.signals = ZoneSignals(
                er_wait_delta=max(-5, min(50, round(s.er_wait_delta + random.uniform(-1.5, 1.5), 1))),
                ambulance_count=max(0, min(6, s.ambulance_count + random.choice([-1, 0, 0, 0, 1]))),
                volunteer_availability=max(0.0, min(1.0, round(s.volunteer_availability + random.uniform(-0.03, 0.03), 2))),
                incident_density_adjacent=max(0, min(15, s.incident_density_adjacent + random.choice([-1, 0, 0, 1]))),
                crowd_density=max(0.0, min(1.0, round(s.crowd_density + random.uniform(-0.03, 0.03), 2))),
                time_of_day=hour,
            )

    # ── Flood control ──────────────────────────────────────────────────────────
    def start_flood(self) -> None:
        self.flood_active = True
        self.flood_tick = 0
        hour = datetime.now().hour
        # Prime signals so first ML pass immediately escalates.
        z = self.store.zones.get(FLOOD_ZONE)
        if z:
            z.signals = ZoneSignals(
                er_wait_delta=30.0, ambulance_count=1,
                volunteer_availability=0.12, incident_density_adjacent=8,
                crowd_density=0.82, time_of_day=hour,
            )

    def stop_flood(self) -> None:
        self.flood_active = False
        self.flood_tick = 0

    def _controlled_zone_ids(self) -> set:
        return {FLOOD_ZONE} | set(FLOOD_ADJACENT)

    def _set_pressure(self, zid: int, pressure: float) -> None:
        """Directly write pressure + status + matching signals."""
        z = self.store.zones.get(zid)
        if not z:
            return
        prev = z.pressure_score
        # Lerp 75% toward target per tick for smooth animation.
        z.pressure_score = round(prev + (pressure - prev) * 0.75, 1)
        z.pressure_score = max(0.0, min(100.0, z.pressure_score))
        z.signals = _make_signals(z.pressure_score, datetime.now().hour)
        if z.pressure_score >= 70:
            z.status = ZoneStatus.red
        elif z.pressure_score >= 40:
            z.status = ZoneStatus.amber
        else:
            z.status = ZoneStatus.green

    def _flood_tick(self) -> None:
        self.flood_tick += 1
        idx = self.flood_tick - 1  # 0-based

        # ── Flood zone ────────────────────────────────────────────────────
        target_f = _FLOOD_P[min(idx, len(_FLOOD_P) - 1)]
        self._set_pressure(FLOOD_ZONE, target_f)

        # ── Adjacent zones ────────────────────────────────────────────────
        for adj_i, zid in enumerate(FLOOD_ADJACENT):
            target_a = _ADJ_P[min(idx, len(_ADJ_P) - 1)] - (adj_i * 4)
            self._set_pressure(zid, max(0, target_a))

        # ── Incidents ─────────────────────────────────────────────────────
        if self.flood_tick == 2:
            self._add_incident("Heavy waterlogging — traffic gridlock near Outer Ring Road.")
        if self.flood_tick == 4:
            self._add_incident("Transformer fire + low-lying areas inundated. Evacuation requested.")

        # ── Ensure suggestions exist at key moments ────────────────────────
        if self.flood_tick >= 2 and not self._has_pending(FLOOD_ZONE):
            self.store._generate_suggestion(
                FLOOD_ZONE,
                ["Flood surge", "Ambulances depleted", "Crowd density critical"],
            )
        if self.flood_tick >= 3 and not self._has_pending(FLOOD_ADJACENT[2]):  # BTM
            self.store._generate_suggestion(
                FLOOD_ADJACENT[2],
                ["Spillover from Bellandur", "ER wait rising", "Incident clusters"],
            )

        # ── Auto-stop after profile ends ──────────────────────────────────
        if self.flood_tick >= len(_FLOOD_P):
            # Force all controlled zones to green before stopping.
            for zid in [FLOOD_ZONE] + FLOOD_ADJACENT:
                self._set_pressure(zid, 18.0)
            self.stop_flood()

    def _has_pending(self, zone_id: int) -> bool:
        return any(
            s.zone_id == zone_id and str(s.status) == "pending"
            for s in self.store.suggestions
        )

    def _add_incident(self, description: str) -> None:
        itype, severity = random.choice(INCIDENT_TYPES)
        self.store.add_incident(Incident(
            id=str(uuid.uuid4()),
            zone_id=FLOOD_ZONE,
            type=itype,
            severity="critical",
            timestamp=datetime.now(timezone.utc).isoformat(),
            description=f"{description} — {self.store.zones[FLOOD_ZONE].name}.",
        ))

    # ── Main tick ──────────────────────────────────────────────────────────────
    def tick(self) -> None:
        """Called every SCORING_INTERVAL seconds."""
        controlled = self._controlled_zone_ids() if self.flood_active else set()

        # Normal fluctuations only on non-controlled zones.
        self._normal_tick(skip_ids=controlled)

        if self.flood_active:
            # Directly control flood/adjacent zones — skip ML scoring for them.
            self._flood_tick()
            # ML scoring only for remaining zones.
            self.store.run_scoring_pass(skip_zone_ids=controlled)
        else:
            self.store.run_scoring_pass()
