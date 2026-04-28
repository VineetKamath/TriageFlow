"""Simulator – background loop with normal fluctuations and flood scenario."""

import random
import uuid
from datetime import datetime, timezone
from typing import Optional

random.seed(42)

from models import Incident, ZoneSignals
from state import StateStore

# With SCORING_INTERVAL=30:
# T+0s   = Tick 0
# T+90s  = Tick 3
# T+150s = Tick 5
# T+180s = Tick 6
# T+210s = Tick 7
# T+240s = Tick 8

FLOOD_ZONE = 12
FLOOD_ADJACENT = [11, 13]

INCIDENT_TYPES = [
    ("Structural collapse", "critical"),
    ("Road flooding", "high"),
    ("Power outage", "medium"),
    ("Evacuation request", "critical"),
    ("Medical emergency", "high"),
    ("Water rescue needed", "critical"),
]


class Simulator:
    """Tick-based simulator driven by the main async loop."""

    def __init__(self, store: StateStore) -> None:
        self.store = store
        self.flood_active = False
        self.flood_tick = 0

    # ------------------------------------------------------------------
    # Normal fluctuations
    # ------------------------------------------------------------------

    def _normal_tick(self) -> None:
        hour = datetime.now().hour
        for zone in self.store.zones.values():
            s = zone.signals
            zone.signals = ZoneSignals(
                er_wait_delta=max(-5, min(50, s.er_wait_delta + random.uniform(-2, 2))),
                ambulance_count=max(0, min(5, s.ambulance_count + random.choice([-1, 0, 0, 0, 1]))),
                volunteer_availability=max(0.0, min(1.0, round(s.volunteer_availability + random.uniform(-0.05, 0.05), 2))),
                incident_density_adjacent=max(0, min(15, s.incident_density_adjacent + random.choice([-1, 0, 0, 1]))),
                crowd_density=max(0.0, min(1.0, round(s.crowd_density + random.uniform(-0.05, 0.05), 2))),
                time_of_day=hour,
            )

    # ------------------------------------------------------------------
    # Flood scenario
    # ------------------------------------------------------------------

    def start_flood(self) -> None:
        self.flood_active = True
        self.flood_tick = 0

    def stop_flood(self) -> None:
        self.flood_active = False
        self.flood_tick = 0

    def _flood_tick(self) -> None:
        self.flood_tick += 1
        
        z12 = self.store.zones[FLOOD_ZONE]
        s12 = z12.signals
        
        # --- T+0 (already started) and throughout: ER Spike in Zone 12 ---
        # We ramp it up every tick.
        s12.er_wait_delta = min(65.0, s12.er_wait_delta + 7.5)
        
        # --- T+90s (Tick 3): Ambulance depletion Zones 11-13 ---
        if self.flood_tick >= 3:
            for zid in FLOOD_ADJACENT:
                z = self.store.zones[zid]
                z.signals.ambulance_count = max(0, z.signals.ambulance_count - 1)
                z.signals.er_wait_delta += 5.0
                
        # --- T+150s (Tick 5): Volunteer drop Zone 12 ---
        if self.flood_tick >= 5:
            s12.volunteer_availability = max(0.05, round(s12.volunteer_availability - 0.2, 2))
            
        # --- T+180s (Tick 6): First formal incident report ---
        if self.flood_tick == 6:
            self._add_flood_incident("Major structural collapse (Flood-related)")
            
        # --- T+210s (Tick 7): Second incident ---
        if self.flood_tick == 7:
            self._add_flood_incident("Widespread power failure in Zone 12")
            
        # --- T+240s (Tick 8): Ensure Zone 12 hits red ---
        if self.flood_tick >= 8:
            s12.er_wait_delta = max(80.0, s12.er_wait_delta)
            s12.crowd_density = 0.95
            s12.incident_density_adjacent = 12.0

    def _add_flood_incident(self, description: str) -> None:
        itype, severity = random.choice(INCIDENT_TYPES)
        self.store.add_incident(Incident(
            id=str(uuid.uuid4()),
            zone_id=FLOOD_ZONE,
            type=itype,
            severity="critical",
            timestamp=datetime.now(timezone.utc).isoformat(),
            description=f"{description} reported in {self.store.zones[FLOOD_ZONE].name}",
        ))

    # ------------------------------------------------------------------
    # Main tick
    # ------------------------------------------------------------------

    def tick(self) -> None:
        """Advance simulation by one 5-second step."""
        self._normal_tick()
        if self.flood_active:
            self._flood_tick()
        self.store.run_scoring_pass()
