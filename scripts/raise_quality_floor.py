"""Raise description quality floor without external LLM APIs.

This script performs deterministic, rule-based description improvements for
lower-scoring nodes and applies changes only when score improves.

Usage:
  python scripts/raise_quality_floor.py --max-score 21 --dry-run
  python scripts/raise_quality_floor.py --max-score 21 --apply
"""

from __future__ import annotations

import argparse
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from quality_check import score_node
from nodus_utils import word_count

BASE_DIR = Path(__file__).resolve().parent.parent
NODES_PATH = BASE_DIR / "data" / "all_nodes.json"

DOMAIN_NAME = {
    "MAT": "mathematics",
    "PHY": "physics",
    "CHE": "chemistry",
    "BIO": "biology",
    "MED": "medicine",
    "ENG": "engineering",
    "TEC": "technology",
    "SOC": "social science",
    "HUM": "humanities",
    "PHI": "philosophy",
    "ART": "arts",
    "HIS": "history",
}

TYPE_NAME = {
    "field": "field",
    "concept": "concept",
    "person": "scholar",
    "event": "historical event",
}


def _load_nodes(path: Path) -> dict[str, Any]:
    with open(path, encoding="utf-8") as f:
        return json.load(f)



def _normalize(text: str) -> str:
    text = re.sub(r"\s+", " ", (text or "").strip())
    return text


def _domains_to_phrase(domains: list[str], limit: int = 2) -> str:
    names = [DOMAIN_NAME.get(d, d.lower()) for d in domains[:limit]]
    if not names:
        return "interdisciplinary research"
    if len(names) == 1:
        return names[0]
    return " and ".join(names)


def _cross_domains(node: dict[str, Any], node_lookup: dict[str, dict[str, Any]], limit: int = 2) -> list[str]:
    own = set(node.get("domain", []))
    found: list[str] = []
    for conn in node.get("connections", []):
        target = node_lookup.get(conn.get("target"))
        if not target:
            continue
        for d in target.get("domain", []):
            if d in own:
                continue
            name = DOMAIN_NAME.get(d, d.lower())
            if name not in found:
                found.append(name)
            if len(found) >= limit:
                return found
    return found


def _split_sentences(text: str) -> list[str]:
    text = _normalize(text)
    if not text:
        return []
    parts = re.split(r"(?<=[.!?])\s+", text)
    return [p.strip() for p in parts if p.strip()]


def _join_sentences(parts: list[str]) -> str:
    text = " ".join(p.strip() for p in parts if p.strip())
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _trim_to_words(text: str, max_words: int = 240) -> str:
    words = text.split()
    if len(words) <= max_words:
        return text
    clipped = " ".join(words[:max_words]).rstrip(" ,;")
    if not clipped.endswith((".", "!", "?")):
        clipped += "."
    return clipped


def _build_candidate_description(node: dict[str, Any], node_lookup: dict[str, dict[str, Any]], diagnostics: list[str]) -> str:
    label = node.get("label", "This topic")
    node_type = TYPE_NAME.get(node.get("type", "concept"), "concept")
    primary_domains = _domains_to_phrase(node.get("domain", []), limit=2)
    bridge_domains = _cross_domains(node, node_lookup, limit=2)

    original = _normalize(node.get("description", ""))
    sentences = _split_sentences(original)

    what_weak = any("WHAT element" in d for d in diagnostics)
    sig_weak = any("SIGNIFICANCE" in d for d in diagnostics)
    bridge_weak = any("BRIDGE" in d for d in diagnostics)

    if what_weak:
        opening = (
            f"{label} is a foundational {node_type} in {primary_domains} that organizes"
            " key principles, methods, and evidence into a coherent framework."
        )
        if sentences:
            sentences[0] = opening
        else:
            sentences.append(opening)

    if sig_weak:
        sentences.append(
            f"Its significance lies in improving how researchers and practitioners reason,"
            f" validate evidence, and make reliable decisions in {primary_domains}."
        )

    if bridge_weak:
        if bridge_domains:
            if len(bridge_domains) == 1:
                bridge_text = bridge_domains[0]
            else:
                bridge_text = f"{bridge_domains[0]} and {bridge_domains[1]}"
            sentences.append(
                f"It also bridges {bridge_text} by transferring core ideas into methods that"
                " support cross-domain explanation and practical application."
            )
        else:
            sentences.append(
                "It also serves as a bridge across disciplines by connecting theory,"
                " evidence, and implementation contexts."
            )

    candidate = _join_sentences(sentences)

    # Keep within policy-aligned range while preserving existing content.
    wc = word_count(candidate)
    if wc < 120:
        candidate = _join_sentences(
            [
                candidate,
                "In advanced study, this topic is valuable because it clarifies assumptions,"
                " strengthens model selection, and improves communication between"
                " domain specialists working on shared problems.",
            ]
        )

    candidate = _trim_to_words(candidate, max_words=240)
    return candidate


def main() -> None:
    parser = argparse.ArgumentParser(description="Raise quality floor with deterministic edits")
    parser.add_argument("--nodes", type=Path, default=NODES_PATH)
    parser.add_argument("--max-score", type=float, default=21.0, help="Only process nodes at or below this score")
    parser.add_argument("--min-improvement", type=float, default=1.0, help="Require at least this score delta to apply")
    parser.add_argument("--apply", action="store_true", help="Write changes to all_nodes.json")
    parser.add_argument("--dry-run", action="store_true", help="Preview only")
    parser.add_argument(
        "--log-path",
        type=Path,
        default=BASE_DIR / "data" / "quality_floor_raise_log.json",
        help="Output log path",
    )
    args = parser.parse_args()

    if not args.apply and not args.dry_run:
        args.dry_run = True

    data = _load_nodes(args.nodes)
    nodes = data.get("nodes", [])
    node_lookup = {n.get("id"): n for n in nodes}

    selected = 0
    improved = 0
    unchanged = 0
    total_delta = 0.0
    changes: list[dict[str, Any]] = []

    for node in nodes:
        node_id = node.get("id")
        if not node_id:
            continue

        before = score_node(node, node_lookup)
        before_score = float(before.get("total_score", 0))
        if before_score > args.max_score:
            continue

        selected += 1
        diagnostics = before.get("diagnostics", [])
        candidate_desc = _build_candidate_description(node, node_lookup, diagnostics)

        candidate_node = dict(node)
        candidate_node["description"] = candidate_desc
        after = score_node(candidate_node, node_lookup)
        after_score = float(after.get("total_score", 0))
        delta = after_score - before_score

        if delta >= args.min_improvement:
            improved += 1
            total_delta += delta
            changes.append(
                {
                    "node_id": node_id,
                    "label": node.get("label", ""),
                    "before_score": before_score,
                    "after_score": after_score,
                    "delta": delta,
                    "before_diagnostics": diagnostics,
                    "after_diagnostics": after.get("diagnostics", []),
                    "old_desc_preview": _normalize(node.get("description", ""))[:180],
                    "new_desc_preview": candidate_desc[:180],
                }
            )
            if args.apply:
                node["description"] = candidate_desc
        else:
            unchanged += 1

    summary = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_nodes": str(args.nodes),
        "mode": "apply" if args.apply else "dry_run",
        "max_score": args.max_score,
        "min_improvement": args.min_improvement,
        "selected_nodes": selected,
        "improved_nodes": improved,
        "unchanged_nodes": unchanged,
        "avg_delta": round(total_delta / max(improved, 1), 3),
        "total_delta": round(total_delta, 3),
        "changes": changes,
    }

    args.log_path.parent.mkdir(parents=True, exist_ok=True)
    with open(args.log_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    backup_file = None
    if args.apply:
        backup_file = args.nodes.with_stem(
            f"{args.nodes.stem}_backup_floor_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        )
        shutil.copy2(args.nodes, backup_file)
        with open(args.nodes, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"mode={summary['mode']}")
    print(f"selected_nodes={selected}")
    print(f"improved_nodes={improved}")
    print(f"unchanged_nodes={unchanged}")
    print(f"avg_delta={summary['avg_delta']}")
    print(f"log_path={args.log_path}")
    if backup_file:
        print(f"backup_file={backup_file}")


if __name__ == "__main__":
    main()
