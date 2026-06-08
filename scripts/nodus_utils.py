"""
Shared utilities for Nodus Knowledge Graph scripts.

Usage:
    from nodus_utils import load_nodes, save_nodes, backup_file, VALID_DOMAINS
    from nodus_utils import neo4j_driver  # requires: pip install neo4j
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


# ── Neo4j helpers ─────────────────────────────────────────────────────────────

def neo4j_driver():
    """Return a Neo4j Driver using config.yaml + env vars NEO4J_USER / NEO4J_PASSWORD.

    Requires: pip install neo4j

    Caller is responsible for closing the driver (use as context manager or call .close()).

    Example:
        with neo4j_driver() as driver:
            with driver.session() as session:
                result = session.run("MATCH (n:Node) RETURN count(n)")
                print(result.single()[0])
    """
    try:
        from neo4j import GraphDatabase  # type: ignore
    except ImportError:
        raise ImportError("neo4j package not installed. Run: pip install neo4j")

    import yaml

    config_path = BASE_DIR / "config.yaml"
    with open(config_path, encoding="utf-8") as f:
        config = yaml.safe_load(f)

    neo4j_cfg = config.get("neo4j", {})
    uri = neo4j_cfg.get("uri", "bolt://localhost:7687")
    user = os.environ.get("NEO4J_USER", "neo4j")
    password = os.environ.get("NEO4J_PASSWORD", "")

    if not password:
        raise EnvironmentError(
            "NEO4J_PASSWORD environment variable is not set. "
            "Set it before using neo4j_driver()."
        )

    return GraphDatabase.driver(uri, auth=(user, password))


# ── Pipeline checkpoint ───────────────────────────────────────────────────────

class Checkpoint:
    """Simple file-based checkpoint to track pipeline step completion.

    State is persisted to data/pipeline_state.json so interrupted runs can
    resume from where they left off.

    Example:
        ck = Checkpoint("p1_enhancement")
        if not ck.is_done("translate_zh"):
            run_translate_zh()
            ck.mark_done("translate_zh", meta={"count": 627})

        # Reset a single step to re-run it:
        ck.reset("translate_zh")

        # Reset all steps in this pipeline:
        ck.reset()
    """

    _STATE_FILE = BASE_DIR / "data" / "pipeline_state.json"

    def __init__(self, pipeline: str) -> None:
        self._pipeline = pipeline

    def _load(self) -> dict:
        if not self._STATE_FILE.exists():
            return {}
        with open(self._STATE_FILE, encoding="utf-8") as f:
            return json.load(f)

    def _save(self, state: dict) -> None:
        self._STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
        tmp = self._STATE_FILE.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")
        os.replace(tmp, self._STATE_FILE)

    def is_done(self, step: str) -> bool:
        """Return True if *step* has been marked done in this pipeline."""
        state = self._load()
        return state.get(self._pipeline, {}).get(step, {}).get("done", False)

    def mark_done(self, step: str, meta: dict | None = None) -> None:
        """Mark *step* as completed, optionally storing *meta* (e.g. counts)."""
        state = self._load()
        state.setdefault(self._pipeline, {})[step] = {
            "done": True,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "meta": meta or {},
        }
        self._save(state)

    def reset(self, step: str | None = None) -> None:
        """Remove checkpoint for *step*, or clear the entire pipeline if step is None."""
        state = self._load()
        pipeline_state = state.get(self._pipeline, {})
        if step is None:
            state.pop(self._pipeline, None)
        else:
            pipeline_state.pop(step, None)
            state[self._pipeline] = pipeline_state
        self._save(state)

    def status(self) -> dict:
        """Return the full checkpoint state for this pipeline."""
        return self._load().get(self._pipeline, {})
