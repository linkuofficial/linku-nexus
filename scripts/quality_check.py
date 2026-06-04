"""
quality_check.py
----------------
深度品質評估：超越 schema 驗證，檢查節點的語義品質。

品質維度：
  1. Description 三要素完整性（WHAT / SIGNIFICANCE / BRIDGE）
  2. Connection relation 文本品質（非泛化、有資訊量）
  3. 跨域橋接真實性（BRIDGE 是否真正提及另一 domain）
  4. 連結多樣性（不過度集中同一 target）
  5. 整體資訊密度

使用方法：
  python quality_check.py                    # 評估所有節點
  python quality_check.py --domain MAT       # 只評估特定 domain
  python quality_check.py --min-score 7      # 只顯示低於此分數的節點
  python quality_check.py --verbose          # 顯示每項評分細節
"""

import json
import re
import argparse
from pathlib import Path
from collections import Counter

import yaml

BASE_DIR = Path(__file__).parent.parent
CONFIG_FILE = BASE_DIR / "config.yaml"

def load_config():
    with open(CONFIG_FILE, encoding="utf-8") as f:
        return yaml.safe_load(f)

CONFIG = load_config()

NODES_FILE = BASE_DIR / CONFIG["paths"]["nodes_file"]
FIELD_NODES_FILE = BASE_DIR / CONFIG["paths"]["field_nodes_file"]

from nodus_utils import VALID_DOMAINS

# Domain 關鍵詞映射（用於偵測 BRIDGE 是否真正跨域）
DOMAIN_KEYWORDS = {
    "MAT": ["mathematic", "equation", "calculus", "algebra", "geometry", "theorem", "proof",
            "statistical", "probability", "formula", "computation", "algorithm", "numerical"],
    "PHY": ["physic", "quantum", "relativity", "force", "energy", "particle", "wave",
            "gravity", "thermodynamic", "electr", "momentum", "atom", "nuclear"],
    "CHE": ["chemi", "molecule", "reaction", "compound", "element", "bond", "catalyst",
            "organic", "synthesis", "polymer", "acid", "solution"],
    "BIO": ["biolog", "evolution", "genetic", "cell", "organism", "species", "ecology",
            "protein", "dna", "ecosystem", "mutation", "natural selection"],
    "MED": ["medic", "disease", "treatment", "clinical", "patient", "therapy", "diagnos",
            "surgery", "pharma", "health", "symptom", "patholog"],
    "ENG": ["engineer", "bridge", "structural", "mechanical", "circuit", "design",
            "infrastructure", "manufacturing", "material", "construction"],
    "TEC": ["technology", "software", "computer", "digital", "internet", "artificial intelligence",
            "machine learning", "data", "network", "programming", "cyber"],
    "SOC": ["social", "society", "economic", "political", "culture", "institution",
            "behavior", "community", "demographic", "governance", "market"],
    "HUM": ["humanit", "literature", "language", "linguistic", "narrative", "text",
            "translation", "rhetoric", "semiot", "hermeneutic"],
    "PHI": ["philosoph", "ethic", "moral", "epistemolog", "metaphysic", "logic",
            "ontolog", "consciousness", "existential", "religious", "theology"],
    "ART": ["art", "music", "aesthetic", "creative", "painting", "sculpture", "composition",
            "performance", "visual", "cinema", "theater", "literary"],
    "HIS": ["histor", "ancient", "medieval", "colonial", "revolution", "empire",
            "civilization", "archaeolog", "dynasty", "war", "period"],
}

# 泛化/低品質 relation 描述的模式
GENERIC_RELATION_PATTERNS = [
    r"^is related to",
    r"^is connected to",
    r"^has a connection",
    r"^is associated with",
    r"^relates to",
    r"^connects to",
    r"^is linked to",
    r"^is part of",
    r"^belongs to",
    r"^is a type of",
    r"^is similar to",
]


def load_nodes():
    target = NODES_FILE if NODES_FILE.exists() else FIELD_NODES_FILE
    with open(target, encoding="utf-8") as f:
        data = json.load(f)
    return data.get("nodes", [])


def detect_domains_in_text(text: str, exclude_domains: list = None) -> set:
    """偵測文本中提及了哪些 domain（透過關鍵詞匹配）"""
    exclude = set(exclude_domains or [])
    text_lower = text.lower()
    found = set()
    
    for domain, keywords in DOMAIN_KEYWORDS.items():
        if domain in exclude:
            continue
        for kw in keywords:
            if kw in text_lower:
                found.add(domain)
                break
    
    return found


def score_description(node: dict) -> dict:
    """
    評估 description 品質，回傳各維度分數和診斷。
    滿分 10 分。
    """
    desc = node.get("description", "")
    node_domains = node.get("domain", [])
    scores = {}
    diagnostics = []
    
    # ── WHAT 元素 (0-3分) ──
    # 好的 WHAT 在前 1-2 句定義了「這是什麼」
    sentences = [s.strip() for s in re.split(r'[.!?]', desc) if s.strip()]
    first_sentence = sentences[0] if sentences else ""
    
    # 檢查是否有定義性語句
    what_indicators = ["is ", "are ", "refers to", "describes", "studies", "examines",
                       "measures", "captures", "represents", "defines"]
    has_what = any(ind in first_sentence.lower() for ind in what_indicators)
    
    if has_what and len(first_sentence.split()) >= 8:
        scores["what"] = 3
    elif has_what:
        scores["what"] = 2
        diagnostics.append("WHAT element present but thin")
    else:
        scores["what"] = 1
        diagnostics.append("WHAT element weak or missing in opening")
    
    # ── SIGNIFICANCE 元素 (0-3分) ──
    sig_indicators = ["important", "significance", "transform", "revolution", "enable",
                      "foundation", "fundamental", "breakthrough", "changed", "shaped",
                      "critical", "essential", "powerful", "key", "major", "impact",
                      "influence", "advance", "pioneer", "solve", "discover"]
    sig_count = sum(1 for ind in sig_indicators if ind in desc.lower())
    
    if sig_count >= 2:
        scores["significance"] = 3
    elif sig_count == 1:
        scores["significance"] = 2
        diagnostics.append("SIGNIFICANCE could be stronger")
    else:
        scores["significance"] = 1
        diagnostics.append("SIGNIFICANCE element weak or missing")
    
    # ── BRIDGE 元素 (0-4分) — 最重要 ──
    # 偵測描述是否真正提及「另一個 domain」的概念
    bridged_domains = detect_domains_in_text(desc, exclude_domains=node_domains)
    
    if len(bridged_domains) >= 2:
        scores["bridge"] = 4
    elif len(bridged_domains) == 1:
        scores["bridge"] = 3
    else:
        # 檢查是否有跨域暗示但沒有明確關鍵詞
        cross_indicators = ["beyond", "across", "outside", "other field", "other discipline",
                           "application in", "applied to", "used in", "bridge"]
        has_cross_hint = any(ind in desc.lower() for ind in cross_indicators)
        if has_cross_hint:
            scores["bridge"] = 2
            diagnostics.append("BRIDGE implied but no specific domain mentioned")
        else:
            scores["bridge"] = 1
            diagnostics.append("BRIDGE element missing — no cross-domain reference")
    
    total = sum(scores.values())
    
    return {
        "total": total,
        "max": 10,
        "scores": scores,
        "bridged_domains": list(bridged_domains),
        "diagnostics": diagnostics
    }


def score_connections(node: dict, node_lookup: dict) -> dict:
    """
    評估 connection 品質。
    滿分 10 分。
    """
    connections = node.get("connections", [])
    scores = {}
    diagnostics = []
    
    if not connections:
        return {"total": 0, "max": 10, "scores": {}, "diagnostics": ["No connections"]}
    
    # ── Relation 文本品質 (0-4分) ──
    generic_count = 0
    short_count = 0
    
    for conn in connections:
        rel_text = conn.get("relation", "")
        
        # 檢查是否泛化
        for pattern in GENERIC_RELATION_PATTERNS:
            if re.match(pattern, rel_text.lower()):
                generic_count += 1
                break
        
        # 檢查長度（好的 relation 應該有具體資訊）
        if len(rel_text.split()) < 8:
            short_count += 1
    
    if generic_count == 0 and short_count == 0:
        scores["relation_quality"] = 4
    elif generic_count == 0 and short_count <= 1:
        scores["relation_quality"] = 3
    elif generic_count <= 1:
        scores["relation_quality"] = 2
        diagnostics.append(f"{generic_count} generic + {short_count} short relation texts")
    else:
        scores["relation_quality"] = 1
        diagnostics.append(f"{generic_count} generic relations — lacks specificity")
    
    # ── 跨域多樣性 (0-3分) ──
    target_domains = set()
    for conn in connections:
        target = node_lookup.get(conn.get("target"))
        if target:
            target_domains.update(target.get("domain", []))
    
    node_domains = set(node.get("domain", []))
    cross_domains = target_domains - node_domains
    
    if len(cross_domains) >= 3:
        scores["domain_diversity"] = 3
    elif len(cross_domains) >= 2:
        scores["domain_diversity"] = 2
    elif len(cross_domains) >= 1:
        scores["domain_diversity"] = 1
        diagnostics.append("Limited cross-domain reach in connections")
    else:
        scores["domain_diversity"] = 0
        diagnostics.append("No cross-domain connections resolved")
    
    # ── 連結目標多樣性 (0-3分) ──
    # 不應全部指向同類型的 target
    target_types = Counter()
    for conn in connections:
        target = node_lookup.get(conn.get("target"))
        if target:
            target_types[target.get("type")] += 1
    
    relation_types = set(conn.get("relation_type") for conn in connections)
    
    if len(relation_types) >= 3:
        scores["relation_diversity"] = 3
    elif len(relation_types) >= 2:
        scores["relation_diversity"] = 2
    else:
        scores["relation_diversity"] = 1
        diagnostics.append("All connections use same relation_type")
    
    total = sum(scores.values())
    
    return {
        "total": total,
        "max": 10,
        "scores": scores,
        "diagnostics": diagnostics
    }


def score_information_density(node: dict) -> dict:
    """
    評估整體資訊密度。
    滿分 5 分。
    """
    desc = node.get("description", "")
    scores = {}
    diagnostics = []
    
    # ── 詞彙豐富度 (0-2分) ──
    words = re.findall(r"\b\w+\b", desc.lower())
    unique_ratio = len(set(words)) / max(len(words), 1)
    
    if unique_ratio >= 0.65:
        scores["lexical_richness"] = 2
    elif unique_ratio >= 0.55:
        scores["lexical_richness"] = 1
    else:
        scores["lexical_richness"] = 0
        diagnostics.append(f"Low lexical diversity ({unique_ratio:.0%} unique words)")
    
    # ── 具體性 (0-2分) ──
    # 具體概念：數字、年份、人名、地名、技術術語
    specifics = (
        len(re.findall(r"\b\d{3,4}\b", desc)) +  # 年份
        len(re.findall(r"\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)*\b", desc))  # 專有名詞
    )
    
    if specifics >= 3:
        scores["specificity"] = 2
    elif specifics >= 1:
        scores["specificity"] = 1
    else:
        scores["specificity"] = 0
        diagnostics.append("Description lacks specific examples, dates, or names")
    
    # ── Display tags 資訊量 (0-1分) ──
    tags = node.get("display_tags", [])
    if len(tags) >= 3:
        scores["tag_coverage"] = 1
    else:
        scores["tag_coverage"] = 0
    
    total = sum(scores.values())
    
    return {
        "total": total,
        "max": 5,
        "scores": scores,
        "diagnostics": diagnostics
    }


def score_node(node: dict, node_lookup: dict) -> dict:
    """
    綜合品質評分。
    滿分 25 分，按 A/B/C/D/F 等級分類。
    """
    desc_result = score_description(node)
    conn_result = score_connections(node, node_lookup)
    info_result = score_information_density(node)
    
    total = desc_result["total"] + conn_result["total"] + info_result["total"]
    max_total = 25
    
    # 等級劃分
    pct = total / max_total
    if pct >= 0.85:
        grade = "A"
    elif pct >= 0.70:
        grade = "B"
    elif pct >= 0.55:
        grade = "C"
    elif pct >= 0.40:
        grade = "D"
    else:
        grade = "F"
    
    all_diagnostics = desc_result["diagnostics"] + conn_result["diagnostics"] + info_result["diagnostics"]
    
    return {
        "id": node["id"],
        "label": node.get("label", ""),
        "total_score": total,
        "max_score": max_total,
        "percentage": round(pct * 100),
        "grade": grade,
        "description": desc_result,
        "connections": conn_result,
        "information": info_result,
        "diagnostics": all_diagnostics,
    }


def main():
    parser = argparse.ArgumentParser(description="Deep quality assessment for knowledge graph nodes")
    parser.add_argument("--domain", type=str, default=None, help="Filter by domain")
    parser.add_argument("--type", type=str, default=None, help="Filter by node type")
    parser.add_argument("--min-score", type=int, default=None, help="Only show nodes below this score")
    parser.add_argument("--verbose", action="store_true", help="Show detailed scoring breakdown")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    args = parser.parse_args()
    
    nodes = load_nodes()
    node_lookup = {n["id"]: n for n in nodes}
    
    # 過濾
    filtered = nodes
    if args.domain:
        filtered = [n for n in filtered if args.domain in n.get("domain", [])]
    if args.type:
        filtered = [n for n in filtered if n.get("type") == args.type]
    
    print(f"Quality assessment: {len(filtered)} nodes\n")
    
    results = []
    for node in filtered:
        result = score_node(node, node_lookup)
        results.append(result)
    
    # 排序（最低分優先）
    results.sort(key=lambda r: r["total_score"])
    
    # 過濾低分
    if args.min_score is not None:
        results = [r for r in results if r["total_score"] < args.min_score]
    
    if args.json:
        print(json.dumps(results, ensure_ascii=False, indent=2))
        return
    
    # 等級分佈
    grade_dist = Counter(r["grade"] for r in results)
    print("GRADE DISTRIBUTION:")
    for grade in ["A", "B", "C", "D", "F"]:
        count = grade_dist.get(grade, 0)
        bar = "#" * count
        print(f"  {grade}: {count:3d}  {bar}")
    
    avg_score = sum(r["total_score"] for r in results) / max(len(results), 1)
    print(f"\n  Average: {avg_score:.1f}/25 ({avg_score/25*100:.0f}%)")
    
    # 各維度平均
    avg_desc = sum(r["description"]["total"] for r in results) / max(len(results), 1)
    avg_conn = sum(r["connections"]["total"] for r in results) / max(len(results), 1)
    avg_info = sum(r["information"]["total"] for r in results) / max(len(results), 1)
    print(f"\n  Description:  {avg_desc:.1f}/10")
    print(f"  Connections:  {avg_conn:.1f}/10")
    print(f"  Information:  {avg_info:.1f}/5")
    
    # 顯示低分節點
    low_scoring = [r for r in results if r["grade"] in ("D", "F")]
    if low_scoring:
        print(f"\nLOW QUALITY NODES ({len(low_scoring)}):")
        print("-" * 60)
        for r in low_scoring:
            print(f"\n  [{r['grade']}] {r['id']} ({r['total_score']}/25)")
            for d in r["diagnostics"]:
                print(f"      - {d}")
    
    # Verbose 模式：顯示所有節點
    if args.verbose:
        print(f"\nALL NODES (sorted by score):")
        print("-" * 60)
        for r in results:
            print(f"\n  [{r['grade']}] {r['id']} — {r['total_score']}/25 ({r['percentage']}%)")
            print(f"      Desc: {r['description']['scores']} = {r['description']['total']}/10")
            print(f"      Conn: {r['connections']['scores']} = {r['connections']['total']}/10")
            print(f"      Info: {r['information']['scores']} = {r['information']['total']}/5")
            if r["description"].get("bridged_domains"):
                print(f"      Bridge to: {r['description']['bridged_domains']}")
            if r["diagnostics"]:
                for d in r["diagnostics"]:
                    print(f"      ! {d}")
    
    # 常見問題統計
    all_diag = []
    for r in results:
        all_diag.extend(r["diagnostics"])
    
    if all_diag:
        print(f"\nMOST COMMON ISSUES:")
        diag_counts = Counter(all_diag)
        for issue, count in diag_counts.most_common(5):
            print(f"  ({count}x) {issue}")
    
    # 建議
    print(f"\n{'='*60}")
    if avg_score >= 20:
        print("Quality: EXCELLENT — ready for production generation")
    elif avg_score >= 16:
        print("Quality: GOOD — minor improvements recommended before scaling")
    elif avg_score >= 12:
        print("Quality: FAIR — address common issues before batch generation")
    else:
        print("Quality: NEEDS WORK — significant prompt improvements required")

if __name__ == "__main__":
    main()
