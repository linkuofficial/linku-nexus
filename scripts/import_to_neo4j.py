"""
import_to_neo4j.py
-----------------
將 data/all_nodes.json 匯入 Neo4j，建立 :Node 節點與 :RELATES_TO 關係。

此腳本為本地開發工具，讓你能用 Cypher 查詢圖結構：
  - 找孤立節點 / 低連通節點
  - 分析跨域叢集
  - 偵測重複或相似概念

需求：
  pip install neo4j pyyaml
  環境變數：NEO4J_USER（預設 "neo4j"）, NEO4J_PASSWORD（必填）

使用方法：
  python import_to_neo4j.py              # 匯入所有節點
  python import_to_neo4j.py --wipe       # 先清除既有資料再匯入
  python import_to_neo4j.py --dry-run    # 只顯示會執行的操作，不實際寫入

Neo4j schema：
  (:Node {id, label_en, label_zh, label_ja, type, field, domains[], tags[],
          description, description_zh, description_ja})
  (:Node)-[:RELATES_TO {relation_type, relation, weight}]->(:Node)
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
NODES_PATH = BASE_DIR / "data" / "all_nodes.json"
I18N_DIR = BASE_DIR / "data" / "i18n"


def _load_nodes() -> list[dict]:
    with open(NODES_PATH, encoding="utf-8") as f:
        data = json.load(f)
    return data.get("nodes", [])


def _load_descriptions(locale: str) -> dict[str, str]:
    path = I18N_DIR / f"{locale}_descriptions.json"
    if not path.exists():
        return {}
    with open(path, encoding="utf-8") as f:
        payload = json.load(f)
    if isinstance(payload.get("descriptions"), dict):
        return payload["descriptions"]
    return payload if isinstance(payload, dict) else {}


def _node_props(node: dict, zh_desc: dict, ja_desc: dict) -> dict:
    labels = node.get("label", {})
    node_id = node["id"]
    return {
        "id": node_id,
        "label_en": labels.get("en", ""),
        "label_zh": labels.get("zh", ""),
        "label_ja": labels.get("ja", ""),
        "type": node.get("type", ""),
        "field": node.get("field", ""),
        "domains": node.get("domain", []),
        "tags": node.get("display_tags", []),
        "description": node.get("description", ""),
        "description_zh": zh_desc.get(node_id, ""),
        "description_ja": ja_desc.get(node_id, ""),
    }


def _wipe(session) -> None:
    session.run("MATCH (n:Node) DETACH DELETE n")
    print("Wiped all :Node nodes and relationships.")


def _create_constraints(session) -> None:
    session.run(
        "CREATE CONSTRAINT node_id IF NOT EXISTS "
        "FOR (n:Node) REQUIRE n.id IS UNIQUE"
    )


def _import_nodes(session, nodes: list[dict], zh_desc: dict, ja_desc: dict) -> int:
    props_list = [_node_props(n, zh_desc, ja_desc) for n in nodes]
    session.run(
        """
        UNWIND $nodes AS props
        MERGE (n:Node {id: props.id})
        SET n += props
        """,
        nodes=props_list,
    )
    return len(props_list)


def _import_relations(session, nodes: list[dict]) -> int:
    rels: list[dict] = []
    node_ids = {n["id"] for n in nodes}
    for node in nodes:
        for conn in node.get("connections", []):
            target = conn.get("target")
            if target and target in node_ids:
                rels.append({
                    "src": node["id"],
                    "tgt": target,
                    "relation_type": conn.get("relation_type", ""),
                    "relation": conn.get("relation", ""),
                    "weight": conn.get("weight", 1.0),
                })

    if not rels:
        return 0

    session.run(
        """
        UNWIND $rels AS r
        MATCH (src:Node {id: r.src})
        MATCH (tgt:Node {id: r.tgt})
        MERGE (src)-[rel:RELATES_TO {relation_type: r.relation_type}]->(tgt)
        SET rel.relation = r.relation, rel.weight = r.weight
        """,
        rels=rels,
    )
    return len(rels)


def main() -> None:
    parser = argparse.ArgumentParser(description="Import all_nodes.json into Neo4j")
    parser.add_argument("--wipe", action="store_true", help="Delete all :Node data before importing")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be done without writing to Neo4j")
    args = parser.parse_args()

    nodes = _load_nodes()
    zh_desc = _load_descriptions("zh")
    ja_desc = _load_descriptions("ja")

    print(f"Loaded {len(nodes)} nodes from {NODES_PATH}")
    relation_count = sum(len(n.get("connections", [])) for n in nodes)
    print(f"Total connections to import: {relation_count}")

    if args.dry_run:
        print("\n[dry-run] Would perform:")
        if args.wipe:
            print("  DETACH DELETE all :Node nodes")
        print(f"  MERGE {len(nodes)} :Node nodes with properties")
        print(f"  MERGE up to {relation_count} :RELATES_TO relationships")
        print("\nRe-run without --dry-run to execute.")
        return

    from nodus_utils import neo4j_driver  # type: ignore

    try:
        driver = neo4j_driver()
    except (ImportError, EnvironmentError) as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)

    with driver:
        with driver.session() as session:
            _create_constraints(session)
            if args.wipe:
                _wipe(session)
            n_nodes = _import_nodes(session, nodes, zh_desc, ja_desc)
            n_rels = _import_relations(session, nodes)

    print(f"\nImport complete:")
    print(f"  Nodes merged:         {n_nodes}")
    print(f"  Relationships merged: {n_rels}")
    print("\nVerify in Neo4j Browser:")
    print('  MATCH (n:Node) RETURN count(n)')
    print('  MATCH ()-[r:RELATES_TO]->() RETURN count(r)')
    print('  MATCH (n:Node)-[:RELATES_TO]->(m:Node) RETURN n.label_en, m.label_en LIMIT 10')


if __name__ == "__main__":
    main()
