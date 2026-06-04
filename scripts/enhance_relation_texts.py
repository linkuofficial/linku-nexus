"""
Enhance short/empty connection relation texts in all_nodes.json.

Usage:
  python scripts/enhance_relation_texts.py --dry-run
  python scripts/enhance_relation_texts.py --write
"""

from __future__ import annotations

import argparse
import json
import shutil
from collections import Counter
from datetime import datetime
from pathlib import Path

from nodus_utils import word_count

BASE_DIR = Path(__file__).parent.parent
NODES_FILE = BASE_DIR / "data" / "all_nodes.json"


def relation_sentence(source_label: str, target_label: str, relation_type: str) -> str:
    templates = {
        "logical": "{src} provides conceptual grounding that helps explain {tgt} in this knowledge graph.",
        "historical": "{src} historically shaped the development and interpretation of {tgt} across contexts.",
        "causal": "{src} contributes causal mechanisms that significantly influence outcomes in {tgt}.",
        "applied": "{src} is applied through practical methods that strengthen real-world work in {tgt}.",
        "conceptual": "{src} offers a conceptual lens that clarifies assumptions and reasoning within {tgt}.",
        "contradicts": "{src} challenges central claims connected to {tgt}, creating productive theoretical tension.",
    }
    template = templates.get(relation_type, templates["conceptual"])
    return template.format(src=source_label, tgt=target_label)


def enhance_relations(nodes: list[dict]) -> tuple[int, int, Counter]:
    node_lookup = {n.get("id"): n for n in nodes}

    updated = 0
    scanned = 0
    by_type: Counter = Counter()

    for node in nodes:
        src_label = node.get("label", node.get("id", "Unknown source"))
        for conn in node.get("connections", []):
            scanned += 1
            current = (conn.get("relation") or "").strip()
            if current and word_count(current) >= 8:
                continue

            target = node_lookup.get(conn.get("target"), {})
            tgt_label = target.get("label", conn.get("target", "Unknown target"))
            r_type = conn.get("relation_type", "conceptual")
            conn["relation"] = relation_sentence(src_label, tgt_label, r_type)
            updated += 1
            by_type[r_type] += 1

    return scanned, updated, by_type


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Enhance short/empty relation texts")
    parser.add_argument("--write", action="store_true", help="Persist changes to all_nodes.json")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without writing")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if not args.write and not args.dry_run:
        args.dry_run = True

    with open(NODES_FILE, encoding="utf-8") as f:
        payload = json.load(f)

    nodes = payload.get("nodes", [])
    scanned, updated, by_type = enhance_relations(nodes)

    print(f"Scanned connections: {scanned}")
    print(f"Updated relations: {updated}")
    if updated:
        for rel_type, count in sorted(by_type.items(), key=lambda x: (-x[1], x[0])):
            print(f"  {rel_type}: {count}")

    if args.write:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_file = NODES_FILE.with_stem(f"{NODES_FILE.stem}_backup_relation_texts_{ts}")
        shutil.copy2(NODES_FILE, backup_file)
        with open(NODES_FILE, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2, ensure_ascii=False)
        print(f"Backup written: {backup_file.name}")
        print(f"Updated file: {NODES_FILE.name}")


if __name__ == "__main__":
    main()
