"""Fill missing Japanese descriptions without external APIs.

Strategy:
- Keep existing high-quality Japanese descriptions untouched.
- For missing keys, generate deterministic Japanese descriptions from node metadata.
- Create a timestamped backup before writing.

Usage:
  python scripts/fill_ja_descriptions_deterministic.py
"""

from __future__ import annotations

import json
import shutil
from datetime import datetime
from pathlib import Path
from typing import Any

BASE_DIR = Path(__file__).resolve().parent.parent
NODES_PATH = BASE_DIR / "data" / "all_nodes.json"
JA_LABELS_PATH = BASE_DIR / "data" / "i18n" / "ja.json"
JA_DESC_PATH = BASE_DIR / "data" / "i18n" / "ja_descriptions.json"

DOMAIN_JA = {
    "MAT": "数学",
    "PHY": "物理学",
    "CHE": "化学",
    "BIO": "生物学",
    "MED": "医学",
    "ENG": "工学",
    "TEC": "技術",
    "SOC": "社会科学",
    "HUM": "人文学",
    "PHI": "哲学",
    "ART": "芸術",
    "HIS": "歴史学",
}

TYPE_JA = {
    "field": "分野",
    "concept": "概念",
    "person": "人物",
    "event": "出来事",
}


def _load_json(path: Path) -> Any:
    with open(path, encoding="utf-8-sig") as f:
        return json.load(f)


def _save_json(path: Path, data: Any) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def _normalize_desc_payload(payload: Any) -> dict[str, str]:
    if isinstance(payload, dict):
        nested = payload.get("descriptions")
        if isinstance(nested, dict):
            return {k: str(v) for k, v in nested.items()}
        if payload.get("meta") and "descriptions" in payload:
            nested2 = payload.get("descriptions")
            return {k: str(v) for k, v in (nested2 or {}).items()}
        return {k: str(v) for k, v in payload.items() if isinstance(v, str)}
    return {}


def _domain_phrase(domains: list[str]) -> str:
    names = [DOMAIN_JA.get(d, d) for d in domains if isinstance(d, str)]
    if not names:
        return "学際領域"
    if len(names) == 1:
        return names[0]
    if len(names) == 2:
        return f"{names[0]}と{names[1]}"
    return "、".join(names[:3])


def _make_description(node: dict[str, Any], ja_label: str) -> str:
    node_type = TYPE_JA.get(str(node.get("type", "concept")), "概念")
    domain_phrase = _domain_phrase(node.get("domain", []))

    first = (
        f"{ja_label}は{domain_phrase}における重要な{node_type}であり、"
        "基礎概念・方法・実践を接続する学習上の中核テーマである。"
    )
    second = (
        "Nodusでは関連ノードとの接続を通じて、定義、意義、応用範囲を"
        "段階的に理解できるよう設計されている。"
    )
    third = (
        "背景知識と横断的な文脈を合わせて把握することで、"
        "他分野への展開可能性を評価しやすくなる。"
    )
    return first + second + third


def main() -> None:
    nodes_payload = _load_json(NODES_PATH)
    nodes = nodes_payload.get("nodes", [])
    node_by_id = {n.get("id"): n for n in nodes if n.get("id")}

    ja_labels = _load_json(JA_LABELS_PATH)
    ja_existing_payload = _load_json(JA_DESC_PATH) if JA_DESC_PATH.exists() else {}
    ja_existing = _normalize_desc_payload(ja_existing_payload)

    # Backup existing JA descriptions file before writing.
    if JA_DESC_PATH.exists():
        backup = JA_DESC_PATH.with_name(
            f"ja_descriptions_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        )
        shutil.copy2(JA_DESC_PATH, backup)
        print(f"backup_file={backup}")

    total = 0
    updated = 0
    preserved = 0

    for node_id, node in node_by_id.items():
        total += 1
        current = str(ja_existing.get(node_id, "")).strip()
        if current:
            preserved += 1
            continue

        label = str(ja_labels.get(node_id, node.get("label", node_id)))
        ja_existing[node_id] = _make_description(node, label)
        updated += 1

    _save_json(JA_DESC_PATH, ja_existing)

    print(f"total_nodes={total}")
    print(f"preserved_existing={preserved}")
    print(f"filled_missing={updated}")
    print(f"final_count={len(ja_existing)}")
    print(f"output_file={JA_DESC_PATH}")


if __name__ == "__main__":
    main()
