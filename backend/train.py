"""Generate synthetic training data, train Random Forest model, and create zones GeoJSON."""

import json
import os
import pickle

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split

ZONE_NAMES = [
    "Northgate", "Riverside", "Central", "Eastfield",
    "Harbourside", "Millbrook", "Queensway", "Docklands",
    "Westend", "Highpark", "Southside", "Floodplain",
    "Midtown", "Crossroads", "Lakeside", "Oldtown",
    "Newbridge", "Marshgate", "Hilltop", "Ferndale",
]

FEATURES = [
    "er_wait_delta",
    "ambulance_count",
    "volunteer_availability",
    "incident_density_adjacent",
    "crowd_density",
    "time_of_day",
]

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")


# ---------------------------------------------------------------------------
# GeoJSON generation – 4 columns × 5 rows grid over Manhattan-ish area
# ---------------------------------------------------------------------------

def generate_zones_geojson() -> dict:
    base_lat, base_lng = 40.73, -74.01
    cell_h, cell_w = 0.01, 0.012

    features = []
    for i in range(20):
        row, col = divmod(i, 4)
        min_lat = base_lat + (4 - row) * cell_h
        max_lat = min_lat + cell_h
        min_lng = base_lng + col * cell_w
        max_lng = min_lng + cell_w

        features.append({
            "type": "Feature",
            "properties": {
                "id": i + 1,
                "name": ZONE_NAMES[i],
                "center_lat": round((min_lat + max_lat) / 2, 6),
                "center_lng": round((min_lng + max_lng) / 2, 6),
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [round(min_lng, 6), round(min_lat, 6)],
                    [round(max_lng, 6), round(min_lat, 6)],
                    [round(max_lng, 6), round(max_lat, 6)],
                    [round(min_lng, 6), round(max_lat, 6)],
                    [round(min_lng, 6), round(min_lat, 6)],
                ]],
            },
        })

    return {"type": "FeatureCollection", "features": features}


# ---------------------------------------------------------------------------
# Synthetic data generation
# ---------------------------------------------------------------------------

def _raw_pressure(er, amb, vol, inc, crowd) -> float:
    """Compute a deterministic raw pressure value from features."""
    return (
        (er / 50) * 30
        + ((5 - amb) / 5) * 25
        + (1 - vol) * 15
        + (inc / 15) * 20
        + crowd * 10
    )


def generate_synthetic_data(n_samples: int = 2000) -> pd.DataFrame:
    rng = np.random.default_rng(42)

    er = rng.uniform(-5, 50, n_samples)
    amb = rng.integers(0, 6, n_samples).astype(float)
    vol = rng.uniform(0, 1, n_samples)
    inc = rng.integers(0, 16, n_samples).astype(float)
    crowd = rng.uniform(0, 1, n_samples)
    tod = rng.integers(0, 24, n_samples).astype(float)

    # To ensure clear separation, we use a more deterministic labeling
    # without too much noise in the core logic.
    raw = np.array([
        _raw_pressure(e, a, v, i, c)
        for e, a, v, i, c in zip(er, amb, vol, inc, crowd)
    ]) 
    
    # Add a tiny bit of noise but not enough to blur classes
    raw += rng.normal(0, 2, n_samples)

    labels = np.zeros(n_samples, dtype=int)
    labels[raw > 35] = 1
    labels[raw > 65] = 2

    return pd.DataFrame({
        "er_wait_delta": er,
        "ambulance_count": amb,
        "volunteer_availability": vol,
        "incident_density_adjacent": inc,
        "crowd_density": crowd,
        "time_of_day": tod,
        "pressure_level": labels,
    })


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------

def train_model() -> RandomForestClassifier:
    n_samples = 2000
    while True:
        print(f"--- Training with {n_samples} samples ---")
        df = generate_synthetic_data(n_samples)
        X = df[FEATURES]
        y = df["pressure_level"]

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )

        model = RandomForestClassifier(n_estimators=120, max_depth=12, random_state=42)
        model.fit(X_train, y_train)

        test_acc = model.score(X_test, y_test)
        print(f"Train accuracy : {model.score(X_train, y_train):.4f}")
        print(f"Test  accuracy : {test_acc:.4f}")

        if test_acc >= 0.85:
            print("Target accuracy achieved!")
            break
        else:
            print("Accuracy below 85%, doubling data...")
            n_samples *= 2

    print("\nFeature Importances:")
    importances = model.feature_importances_
    for feat, imp in zip(FEATURES, importances):
        print(f"  {feat:>30s}  {imp:.4f}")

    return model


# ---------------------------------------------------------------------------
# CLI entry-point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    os.makedirs(DATA_DIR, exist_ok=True)

    # 1. GeoJSON
    geojson = generate_zones_geojson()
    path = os.path.join(DATA_DIR, "zones.geojson")
    with open(path, "w") as f:
        json.dump(geojson, f, indent=2)
    print(f"[OK] Wrote {path}")

    # 2. Model
    model = train_model()
    path = os.path.join(DATA_DIR, "model.pkl")
    with open(path, "wb") as f:
        pickle.dump(model, f)
    print(f"[OK] Wrote {path}")
