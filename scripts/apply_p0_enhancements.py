"""
apply_p0_enhancements.py
------------------------
Apply approved enhancement wave descriptions to all_nodes.json.

?箸瘙箇?銵剁??芸?憟撌脫??憓撥嚗蒂??霈?勗???

?冽?嚗?
  python scripts/apply_p0_enhancements.py
  python scripts/apply_p0_enhancements.py --decisions data/p0_candidates_consolidated_decisions.json
  python scripts/apply_p0_enhancements.py --consolidated data/p0_candidates_consolidated.json --decisions data/p0_candidates_consolidated_decisions.json
"""

import json
import os
import argparse
import shutil
from pathlib import Path
from datetime import datetime, timezone
from collections import defaultdict


BASE_DIR = Path(__file__).parent.parent
NODES_FILE = BASE_DIR / "data" / "all_nodes.json"


def load_nodes(nodes_file: Path):
    with open(nodes_file, encoding="utf-8") as f:
        return json.load(f)


def load_decisions(decisions_file: Path):
    with open(decisions_file, encoding="utf-8") as f:
        data = json.load(f)
    return data.get("decisions", [])


def load_consolidated(consolidated_file: Path):
    """Load consolidated enhancement results"""
    with open(consolidated_file, encoding="utf-8") as f:
        data = json.load(f)

    raw_results = {
        r["node_id"]: r
        for r in data.get("raw_results", [])
        if r.get("status") == "completed"
    }
    if raw_results:
        return raw_results

    return {r["node_id"]: r for r in data.get("review_table", [])}


def apply_enhancements(nodes_data: dict, decisions: list, consolidated_map: dict):
    """
    Apply approved enhancements to nodes.
    
    Returns: (updated_nodes, change_log)
    """
    nodes = nodes_data.get("nodes", [])
    change_log = []
    updated_count = 0
    skipped_count = 0
    
    # Create a quick lookup
    node_index = {n["id"]: i for i, n in enumerate(nodes)}
    
    for decision in decisions:
        node_id = decision["node_id"]
        
        if decision["decision"] != "APPROVE":
            skipped_count += 1
            change_log.append({
                "node_id": node_id,
                "label": decision["label"],
                "status": "skipped",
                "reason": decision["reason"]
            })
            continue
        
        # Get enhanced description from consolidated results
        if node_id not in consolidated_map:
            change_log.append({
                "node_id": node_id,
                "label": decision["label"],
                "status": "error",
                "reason": "Enhanced description not found in consolidated results"
            })
            continue
        
        enhanced = consolidated_map[node_id]
        enhanced_desc = enhanced["enhanced_description"]
        
        # Apply to nodes
        if node_id in node_index:
            idx = node_index[node_id]
            old_desc = nodes[idx].get("description", "")
            nodes[idx]["description"] = enhanced_desc
            
            change_log.append({
                "node_id": node_id,
                "label": decision["label"],
                "status": "applied",
                "before_score": decision["score_before"],
                "after_score": decision["score_after"],
                "score_delta": decision["improvement"],
                "old_desc_preview": old_desc[:80] + "..." if len(old_desc) > 80 else old_desc,
                "new_desc_preview": enhanced_desc[:80] + "..." if len(enhanced_desc) > 80 else enhanced_desc
            })
            updated_count += 1
        else:
            change_log.append({
                "node_id": node_id,
                "label": decision["label"],
                "status": "error",
                "reason": f"Node not found in {NODES_FILE.name}"
            })
    
    return nodes_data, change_log, updated_count, skipped_count


def main():
    parser = argparse.ArgumentParser(description="Apply P0 approved enhancements to all_nodes.json")
    parser.add_argument("--consolidated", type=Path,
                        default=BASE_DIR / "data" / "p0_candidates_consolidated.json",
                        help="Consolidated results file")
    parser.add_argument("--decisions", type=Path,
                        default=BASE_DIR / "data" / "p0_candidates_consolidated_decisions.json",
                        help="Decisions file")
    parser.add_argument("--nodes", type=Path, default=NODES_FILE,
                        help="Source all_nodes.json")
    args = parser.parse_args()
    wave_label = args.consolidated.stem.replace("_consolidated", "")
    wave_prefix = wave_label.lower()
    
    print(f"\n{'='*70}")
    print(f"APPLYING {wave_label.upper()} ENHANCEMENTS")
    print(f"{'='*70}")
    
    # Load data
    print(f"Loading nodes from {args.nodes.name}...", end=" ")
    nodes_data = load_nodes(args.nodes)
    print(f"??{len(nodes_data.get('nodes', []))} nodes")
    
    print(f"Loading decisions from {args.decisions.name}...", end=" ")
    decisions = load_decisions(args.decisions)
    print(f"??{len(decisions)} decisions")
    
    print(f"Loading consolidated results from {args.consolidated.name}...", end=" ")
    consolidated_map = load_consolidated(args.consolidated)
    print(f"??{len(consolidated_map)} results")
    
    # Create backup
    backup_file = args.nodes.with_stem(
        f"{args.nodes.stem}_backup_{wave_prefix}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    )
    print(f"\nCreating backup: {backup_file.name}...", end=" ")
    shutil.copy2(args.nodes, backup_file)
    print(f"??)
    
    # Apply enhancements
    print(f"\nApplying enhancements...")
    updated_data, change_log, updated_count, skipped_count = apply_enhancements(
        nodes_data, decisions, consolidated_map
    )
    
    # Summary
    print(f"\nChanges:")
    print(f"  Applied: {updated_count}")
    print(f"  Skipped: {skipped_count}")
    print(f"  Errors: {sum(1 for c in change_log if c['status'] == 'error')}")
    
    # Save updated nodes (atomic write — crash-safe)
    print(f"\nSaving updated nodes to {args.nodes.name}...", end=" ")
    _tmp = Path(str(args.nodes) + ".tmp")
    _tmp.write_text(json.dumps(updated_data, indent=2, ensure_ascii=False), encoding="utf-8")
    os.replace(_tmp, args.nodes)
    print("✓")
    
    # Save change log
    log_file = args.nodes.parent / f"{wave_prefix}_enhancements_apply_log.json"
    print(f"Saving change log to {log_file.name}...", end=" ")
    with open(log_file, "w", encoding="utf-8") as f:
        json.dump({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "source_consolidated": args.consolidated.name,
            "source_decisions": args.decisions.name,
            "source_nodes": args.nodes.name,
            "backup_file": backup_file.name,
            "summary": {
                "total_decisions": len(decisions),
                "applied": updated_count,
                "skipped": skipped_count,
                "errors": sum(1 for c in change_log if c["status"] == "error")
            },
            "change_log": change_log
        }, f, indent=2, ensure_ascii=False)
    print(f"??)
    
    print(f"\n{'='*70}")
    print(f"{wave_label.upper()} ENHANCEMENTS APPLIED SUCCESSFULLY")
    print(f"Backup: {backup_file.name}")
    print(f"Log: {log_file.name}")
    print(f"{'='*70}\n")


if __name__ == "__main__":
    main()

