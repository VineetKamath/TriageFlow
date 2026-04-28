"""Pressure-scoring engine backed by a trained Random Forest model."""

import os
import pickle
import json
import urllib.request
import urllib.error
from typing import Any, Dict, List
from dotenv import load_dotenv

load_dotenv()

import numpy as np
import pandas as pd

FEATURE_NAMES = [
    "er_wait_delta",
    "ambulance_count",
    "volunteer_availability",
    "incident_density_adjacent",
    "crowd_density",
    "time_of_day",
]

# Human-readable explanations keyed by feature name and direction.
_EXPLANATIONS: Dict[str, Dict[str, str]] = {
    "er_wait_delta":             {"high": "ER wait rising",        "low": "ER wait stable"},
    "ambulance_count":           {"high": "Units adequate",        "low": "Units depleted"},
    "volunteer_availability":    {"high": "Volunteers available",  "low": "Volunteers scarce"},
    "incident_density_adjacent": {"high": "Adjacent incidents high", "low": "Adjacent area calm"},
    "crowd_density":             {"high": "Crowd density high",    "low": "Crowd density low"},
    "time_of_day":               {"high": "Peak hours",            "low": "Off-peak hours"},
}

# Thresholds used to decide if a feature value is "high" (concerning).
_HIGH_THRESHOLDS: Dict[str, float] = {
    "er_wait_delta": 10.0,
    "ambulance_count": 2.0,        # <= this → "low" (inverted)
    "volunteer_availability": 0.3,  # <= this → "low" (inverted)
    "incident_density_adjacent": 5.0,
    "crowd_density": 0.5,
    "time_of_day": 17.0,
}


class ScoringEngine:
    """Loads the persisted RF model and exposes ``score_zones``."""

    def __init__(self) -> None:
        self.model = None
        self.gemini_api_key = os.getenv("GEMINI_API_KEY", "").strip()
        self.gemini_model = os.getenv("GEMINI_MODEL", "gemini-1.5-flash-latest").strip()
        self._gemini_disabled = False
        self._gemini_warned = False
        model_path = os.getenv("MODEL_PATH", os.path.join(os.path.dirname(__file__), "data", "model.pkl"))
        try:
            with open(model_path, "rb") as f:
                self.model = pickle.load(f)
        except Exception as e:
            print(f"Warning: Failed to load ML model ({e}). Using fallback scoring.")

    def _fallback_ai_summary(
        self,
        explanations: List[str],
        sig: Dict[str, Any],
        pressure: float,
        status: str,
    ) -> str:
        top_reason = explanations[0] if explanations else "Operational pressure is rising"
        if status == "red":
            action = "Dispatch the nearest available units now and prioritize incident triage in this zone."
        elif status == "amber":
            action = "Pre-stage units nearby and monitor this zone continuously for escalation."
        else:
            action = "Maintain normal coverage and keep watching for trend changes."
        return f"{top_reason}; pressure is {round(pressure, 1)}/100. {action}"

    def _generate_gemini_summary(
        self,
        sig: Dict[str, Any],
        pressure: float,
        fallback_summary: str,
    ) -> str:
        if not self.gemini_api_key or self._gemini_disabled:
            return fallback_summary
        models_to_try = [self.gemini_model, "gemini-1.5-flash", "gemini-2.0-flash"]
        prompt = (
            "Given these emergency zone signals: "
            f"{json.dumps(sig, separators=(',', ':'))}, "
            f"the zone has a pressure score of {round(pressure, 1)}/100. "
            "In one sentence, explain the most urgent reason and the recommended immediate action. "
            "Be direct, like a dispatcher."
        )
        payload = {
            "contents": [
                {
                    "parts": [{"text": prompt}]
                }
            ],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 80,
            },
        }
        data = json.dumps(payload).encode("utf-8")
        for model_name in models_to_try:
            url = (
                f"https://generativelanguage.googleapis.com/v1beta/models/"
                f"{model_name}:generateContent?key={self.gemini_api_key}"
            )
            req = urllib.request.Request(
                url=url,
                data=data,
                method="POST",
                headers={"Content-Type": "application/json"},
            )
            try:
                with urllib.request.urlopen(req, timeout=4) as response:
                    body = json.loads(response.read().decode("utf-8"))
                text = (
                    body.get("candidates", [{}])[0]
                    .get("content", {})
                    .get("parts", [{}])[0]
                    .get("text", "")
                    .strip()
                )
                if text:
                    self.gemini_model = model_name
                    return text
            except urllib.error.HTTPError as e:
                if e.code == 404:
                    continue
                if not self._gemini_warned:
                    print(f"Gemini summary failed: {e}")
                    self._gemini_warned = True
                return fallback_summary
            except (urllib.error.URLError, TimeoutError, KeyError, IndexError, ValueError) as e:
                if not self._gemini_warned:
                    print(f"Gemini summary failed: {e}")
                    self._gemini_warned = True
                return fallback_summary

        # No model resolved for this key; disable further calls to avoid noisy logs.
        if not self._gemini_warned:
            print("Gemini summary disabled: model endpoint not found for provided key.")
            self._gemini_warned = True
        self._gemini_disabled = True
        return fallback_summary

    # ------------------------------------------------------------------
    def score_zones(self, zones_state: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Return pressure score, status, and top-3 explanations per zone."""
        results: List[Dict[str, Any]] = []

        for zone in zones_state:
            sig = zone["signals"]
            # Keep feature names consistent with training (model was fit on a DataFrame).
            feat_vals = [sig.get(fn, 0.0) for fn in FEATURE_NAMES]
            X = pd.DataFrame([feat_vals], columns=FEATURE_NAMES)

            use_fallback = False
            if self.model is None:
                use_fallback = True
            else:
                try:
                    proba = self.model.predict_proba(X)[0]
                    # Weighted combination: medium=50, high=100
                    pressure = float(proba[1] * 50 + proba[2] * 100)
                except Exception as e:
                    print(f"Prediction error for zone {zone['id']}: {e}")
                    use_fallback = True
                    
            if use_fallback:
                pressure = (sig["er_wait_delta"] * 0.4) + ((5 - sig["ambulance_count"]) * 10) + ((1 - sig["volunteer_availability"]) * 20)

            # --- per-zone feature contribution ---------------------------
            if not use_fallback:
                importances = self.model.feature_importances_
            else:
                importances = [1/6] * 6  # fallback uniform importances
            weighted: list[tuple[str, float]] = []
            for i, name in enumerate(FEATURE_NAMES):
                val = feat_vals[i]
                if name == "er_wait_delta":
                    extremeness = val / 50
                elif name == "ambulance_count":
                    extremeness = (5 - val) / 5
                elif name == "volunteer_availability":
                    extremeness = 1 - val
                elif name == "incident_density_adjacent":
                    extremeness = val / 15
                elif name == "crowd_density":
                    extremeness = val
                elif name == "time_of_day":
                    extremeness = 1.0 if (17 <= val <= 23 or 0 <= val <= 2) else 0.3
                else:
                    extremeness = 0.5
                weighted.append((name, importances[i] * max(extremeness, 0)))

            weighted.sort(key=lambda t: t[1], reverse=True)

            explanations: List[str] = []
            for name, _ in weighted[:3]:
                val = feat_vals[FEATURE_NAMES.index(name)]
                # For ambulance_count & volunteer_availability, low value = concerning
                if name in ("ambulance_count", "volunteer_availability"):
                    direction = "low" if val <= _HIGH_THRESHOLDS[name] else "high"
                else:
                    direction = "high" if val >= _HIGH_THRESHOLDS[name] else "low"
                explanations.append(_EXPLANATIONS[name][direction])

            # Status buckets
            alert_threshold = float(os.getenv("ALERT_THRESHOLD", "70"))
            if pressure >= alert_threshold:
                status = "red"
            elif pressure >= 40:
                status = "amber"
            else:
                status = "green"

            fallback_ai_summary = self._fallback_ai_summary(explanations, sig, pressure, status)
            ai_summary = self._generate_gemini_summary(sig, pressure, fallback_ai_summary)

            results.append({
                "zone_id": zone["id"],
                "pressure_score": round(pressure, 1),
                "status": status,
                "explanation": explanations,
                "ai_summary": ai_summary,
            })

        return results


# ---------------------------------------------------------------------------
# Module-level convenience
# ---------------------------------------------------------------------------

_engine: ScoringEngine | None = None


def get_engine() -> ScoringEngine:
    global _engine
    if _engine is None:
        _engine = ScoringEngine()
    return _engine


def score_zones(zones_state: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Score all zones and return list of dicts with pressure_score, status, explanation."""
    return get_engine().score_zones(zones_state)
