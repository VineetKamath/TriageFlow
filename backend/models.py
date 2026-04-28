"""Pydantic schemas for TriageFlow."""

from pydantic import BaseModel
from typing import List
from enum import Enum


class ZoneStatus(str, Enum):
    green = "green"
    amber = "amber"
    red = "red"


class UnitStatus(str, Enum):
    available = "available"
    en_route = "en_route"
    deployed = "deployed"


class SuggestionStatus(str, Enum):
    pending = "pending"
    accepted = "accepted"
    dismissed = "dismissed"


class ZoneSignals(BaseModel):
    er_wait_delta: float = 0.0
    ambulance_count: int = 3
    volunteer_availability: float = 0.7
    incident_density_adjacent: int = 0
    crowd_density: float = 0.3
    time_of_day: int = 12


class Zone(BaseModel):
    id: int
    name: str
    center_lat: float
    center_lng: float
    pressure_score: float = 0.0
    status: ZoneStatus = ZoneStatus.green
    signals: ZoneSignals = ZoneSignals()
    explanation: List[str] = []
    ai_summary: str = ""


class Unit(BaseModel):
    id: int
    zone_id: int
    status: UnitStatus = UnitStatus.available


class Incident(BaseModel):
    id: str
    zone_id: int
    type: str
    severity: str
    timestamp: str
    description: str


class Suggestion(BaseModel):
    id: str
    zone_id: int
    status: SuggestionStatus = SuggestionStatus.pending
    unit_ids: List[int] = []
    explanation: List[str] = []
    created_at: str = ""


class HistoryEntry(BaseModel):
    timestamp: str
    pressure_score: float
    status: str


class AppState(BaseModel):
    zones: List[Zone]
    units: List[Unit]
    suggestions: List[Suggestion]
    incidents: List[Incident]
