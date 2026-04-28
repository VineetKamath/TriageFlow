"""Firebase Admin SDK initialization and Realtime Database helpers."""

import os
from typing import Any

import firebase_admin
from firebase_admin import credentials, db

_initialized = False


def initialize_firebase() -> bool:
    """Initialize Firebase app if env vars are configured."""
    global _initialized
    if _initialized:
        return True

    db_url = os.getenv("FIREBASE_DB_URL", "").strip()
    cred_path = os.getenv("FIREBASE_CREDENTIALS_PATH", "").strip()
    if not db_url or not cred_path:
        return False

    try:
        if not firebase_admin._apps:
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred, {"databaseURL": db_url})
        _initialized = True
        return True
    except Exception as e:
        print(f"Firebase initialization failed: {e}")
        return False


def write_json(path: str, value: Any) -> None:
    """Write JSON-serializable data to a Realtime Database path."""
    try:
        if not initialize_firebase():
            return
        db.reference(path).set(value)
    except Exception as e:
        print(f"Firebase write failed at {path}: {e}")
