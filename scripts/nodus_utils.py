"""
Shared utilities for Nodus Knowledge Graph scripts.

Usage:
    from nodus_utils import load_nodes, save_nodes, backup_file, VALID_DOMAINS
"""

import json
import os
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path

# ── Domain / type constants ──────────────────────────────────────────────────

VALID_DOMAINS = frozenset({
    "MAT", "PHY", "CHE", "BIO", "MED",
    "ENG", "TEC", "SOC", "HUM", "PHI", "ART", "HIS",
})

VALID_TYPES = frozenset({"field", "concept", "person", "event"})

VALID_RELATION_TYPES = frozenset({
    "logical", "historical", "methodological",
    "applied", "analogical", "contradicts",
})

# ── Paths ────────────────────────────────────────────────────────────────────

BASE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_NODES_FILE = BASE_DIR / "data" / "all_nodes.json"


# ── I/O helpers ──────────────────────────────────────────────────────────────

def load_nodes(path: Path | None = None) -> dict:
    """Load all_nodes.json and return the full data dict (with "nodes" and "meta" keys)."""
    target = Path(path) if path else DEFAULT_NODES_FILE
    with open(target, encoding="utf-8") as f:
        return json.load(f)


def get_nodes_list(path: Path | None = None) -> list:
    """Load nodes and return just the list of node dicts."""
    return load_nodes(path).get("nodes", [])


def build_node_lookup(nodes: list) -> dict:
    """Return {node_id: node} dict for O(1) lookups."""
    return {n["id"]: n for n in nodes}


def save_nodes(data: dict, path: Path | None = None) -> None:
    """Write all_nodes.json atomically (write-then-rename, crash-safe).

    Writes to a temporary file first, then uses os.replace() which is
    atomic on POSIX and Windows NTFS. This ensures the file is never
    left in a half-written state even if the process is killed mid-write.
    """
    target = Path(path) if path else DEFAULT_NODES_FILE
    target.parent.mkdir(parents=True, exist_ok=True)
    tmp = target.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    os.replace(tmp, target)


def backup_file(path: Path, prefix: str = "") -> Path:
    """Create a timestamped backup of *path* and return the backup path.

    The backup is created BEFORE the caller reads or modifies the source,
    so it represents the pre-modification state and can be used for rollback.
    """
    path = Path(path)
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    stem = f"{prefix}_{ts}" if prefix else ts
    backup = path.parent / f"{path.stem}_backup_{stem}{path.suffix}"
    shutil.copy2(path, backup)
    return backup


def save_json(data: object, path: Path) -> None:
    """Atomically write any JSON-serialisable object to *path*."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    os.replace(tmp, path)


# ── Text helpers ─────────────────────────────────────────────────────────────

def word_count(text: str) -> int:
    """Count word tokens using regex word-boundary matching."""
    return len(re.findall(r"\b\w+\b", text or ""))
