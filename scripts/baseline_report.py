"""Generate a baseline report for node quality and i18n coverage.

Usage:
  python scripts/baseline_report.py
  python scripts/baseline_report.py --output-prefix baseline_20260525
"""

from __future__ import annotations

import argparse
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
I18N_DIR = DATA_DIR / "i18n"
NODES_PATH = DATA_DIR / "all_nodes.json"
OUTPUT_DIR = BASE_DIR / "docs" / "baselines"


def _load_json(path: Path) -> Any:
    with open(path, encoding="utf-8-sig") as f:
        return json.load(f)


def _safe_load_json(path: Path) -> Any | None:
    if not path.exists():
        return None
    return _load_json(path)


def _unwrap_descriptions(payload: Any) -> dict[str, str]:
    if not isinstance(payload, dict):
        return {}
    nested = payload.get("descriptions")
    if isinstance(nested, dict):
        return nested
    # Ignore obvious metadata-only payloads.
    if "meta" in payload and "descriptions" not in payload:
        return {}
    return payload


def _load_nodes() -> list[dict[str, Any]]:
    payload = _load_json(NODES_PATH)
    return payload.get("nodes", [])


def _quality_snapshot(nodes: list[dict[str, Any]]) -> dict[str, Any]:
    # Reuse production scorer to stay aligned with pipeline metrics.
    from quality_check import score_node  # type: ignore

    node_lookup = {n.get("id"): n for n in nodes}
    scored = [score_node(node, node_lookup) for node in nodes]
    grades = Counter(item["grade"] for item in scored)

    avg_total = sum(item["total_score"] for item in scored) / max(len(scored), 1)
    avg_desc = sum(item["description"]["total"] for item in scored) / max(len(scored), 1)
    avg_conn = sum(item["connections"]["total"] for item in scored) / max(len(scored), 1)
    avg_info = sum(item["information"]["total"] for item in scored) / max(len(scored), 1)

    diag_counter: Counter[str] = Counter()
    for item in scored:
        diag_counter.update(item.get("diagnostics", []))

    low_nodes = [
        {
            "id": item["id"],
            "label": item["label"],
            "grade": item["grade"],
            "score": item["total_score"],
            "diagnostics": item.get("diagnostics", [])[:5],
        }
        for item in sorted(scored, key=lambda x: x["total_score"])[:20]
    ]

    return {
        "node_count": len(nodes),
        "grade_distribution": {k: grades.get(k, 0) for k in ["A", "B", "C", "D", "F"]},
        "avg_total_score": round(avg_total, 3),
        "avg_description_score": round(avg_desc, 3),
        "avg_connection_score": round(avg_conn, 3),
        "avg_information_score": round(avg_info, 3),
        "top_diagnostics": diag_counter.most_common(12),
        "lowest_20_nodes": low_nodes,
    }


def _i18n_labels_snapshot(locales: list[str]) -> dict[str, Any]:
    maps: dict[str, dict[str, str]] = {}
    counts: dict[str, int] = {}

    for locale in locales:
        payload = _safe_load_json(I18N_DIR / f"{locale}.json")
        data = payload if isinstance(payload, dict) else {}
        maps[locale] = data
        counts[locale] = len(data)

    base_keys = set(maps.get("en", {}).keys())
    keyset_aligned = all(set(maps.get(locale, {}).keys()) == base_keys for locale in locales)

    missing: dict[str, int] = {}
    for locale in locales:
        missing[locale] = len(base_keys - set(maps.get(locale, {}).keys()))

    return {
        "counts": counts,
        "keyset_aligned_to_en": keyset_aligned,
        "missing_vs_en": missing,
    }


def _i18n_descriptions_snapshot(nodes: list[dict[str, Any]], locales: list[str]) -> dict[str, Any]:
    # Canonical English baseline is node descriptions from all_nodes.
    baseline_keys = {node.get("id") for node in nodes if node.get("id")}
    baseline_count = len(baseline_keys)

    raw_counts: dict[str, int] = {}
    effective_counts: dict[str, int] = {}
    missing_vs_baseline: dict[str, int] = {}

    for locale in locales:
        payload = _safe_load_json(I18N_DIR / f"{locale}_descriptions.json")
        raw_map = _unwrap_descriptions(payload)
        raw_keys = set(raw_map.keys())
        raw_counts[locale] = len(raw_keys)

        # Effective map after API merge behavior: baseline + locale overrides.
        effective_keys = baseline_keys | raw_keys
        effective_counts[locale] = len(effective_keys)
        missing_vs_baseline[locale] = len(baseline_keys - effective_keys)

    return {
        "baseline_source": "data/all_nodes.json descriptions",
        "baseline_count": baseline_count,
        "raw_counts": raw_counts,
        "effective_counts_after_fallback": effective_counts,
        "missing_vs_baseline_after_fallback": missing_vs_baseline,
        "raw_coverage_pct": {
            locale: round((raw_counts[locale] / max(baseline_count, 1)) * 100.0, 2) for locale in locales
        },
        "effective_coverage_pct": {
            locale: round((effective_counts[locale] / max(baseline_count, 1)) * 100.0, 2)
            for locale in locales
        },
    }


def _validate_snapshot() -> dict[str, Any]:
    from validate_nodes import load_nodes, validate_node  # type: ignore

    nodes = load_nodes()
    lookup = {n.get("id"): n for n in nodes}
    field_ids = {n.get("id") for n in nodes if n.get("type") == "field"}

    errors = 0
    warnings = 0
    nodes_with_errors = 0

    for node in nodes:
        node_errors, node_warnings = validate_node(node, lookup, field_ids)
        if node_errors:
            nodes_with_errors += 1
        errors += len(node_errors)
        warnings += len(node_warnings)

    return {
        "nodes": len(nodes),
        "nodes_with_errors": nodes_with_errors,
        "error_count": errors,
        "warning_count": warnings,
    }


def _render_markdown(report: dict[str, Any]) -> str:
    q = report["quality"]
    v = report["validation"]
    labels = report["i18n_labels"]
    desc = report["i18n_descriptions"]

    top_diag_lines = "\n".join([f"- {count}x {issue}" for issue, count in q["top_diagnostics"][:10]])

    return "\n".join(
        [
            "# Node Optimization Baseline",
            "",
            f"- generated_at: {report['generated_at']}",
            f"- node_count: {q['node_count']}",
            "",
            "## Validation",
            "",
            f"- nodes_with_errors: {v['nodes_with_errors']}",
            f"- error_count: {v['error_count']}",
            f"- warning_count: {v['warning_count']}",
            "",
            "## Quality",
            "",
            f"- avg_total_score: {q['avg_total_score']}/25",
            f"- avg_description_score: {q['avg_description_score']}/10",
            f"- avg_connection_score: {q['avg_connection_score']}/10",
            f"- avg_information_score: {q['avg_information_score']}/5",
            f"- grade_distribution: {q['grade_distribution']}",
            "",
            "## Top Diagnostics",
            "",
            top_diag_lines or "- none",
            "",
            "## i18n Labels",
            "",
            f"- counts: {labels['counts']}",
            f"- keyset_aligned_to_en: {labels['keyset_aligned_to_en']}",
            f"- missing_vs_en: {labels['missing_vs_en']}",
            "",
            "## i18n Descriptions",
            "",
            f"- baseline_count: {desc['baseline_count']}",
            f"- raw_counts: {desc['raw_counts']}",
            f"- raw_coverage_pct: {desc['raw_coverage_pct']}",
            f"- effective_coverage_pct_after_fallback: {desc['effective_coverage_pct']}",
            f"- missing_vs_baseline_after_fallback: {desc['missing_vs_baseline_after_fallback']}",
            "",
        ]
    )


def _assert_gates(report: dict[str, Any], baseline_path: Path) -> bool:
    """Compare report against latest_baseline.json. Returns True if all gates pass."""
    if not baseline_path.exists():
        print("ASSERT-GATES WARNING: latest_baseline.json not found — skipping")
        return True

    with open(baseline_path, encoding="utf-8") as f:
        prev = json.load(f)

    passed = True
    print("\nBASELINE GATES")
    print("=" * 50)

    q_now = report["quality"]
    q_prev = prev.get("quality", {})

    # Gate 1: avg quality score
    avg_now = q_now["avg_total_score"]
    avg_prev = q_prev.get("avg_total_score", 0)
    min_avg = max(avg_prev - 1.0, 0)
    ok_avg = avg_now >= min_avg
    if not ok_avg:
        passed = False
    print(f"  Avg score:   {avg_now:.3f}/25  (prev {avg_prev:.3f}, min {min_avg:.3f})  [{'PASS' if ok_avg else 'FAIL'}]")

    # Gate 2: validation errors must stay at 0
    v_now = report["validation"]["error_count"]
    ok_v = v_now == 0
    if not ok_v:
        passed = False
    print(f"  Errors:      {v_now}         (must be 0)  [{'PASS' if ok_v else 'FAIL'}]")

    # Gate 3: i18n effective coverage must stay at 100% for zh and ja
    desc_now = report["i18n_descriptions"]["effective_coverage_pct"]
    for locale in ("zh", "ja"):
        cov = desc_now.get(locale, 0)
        ok_cov = cov >= 100.0
        if not ok_cov:
            passed = False
        print(f"  i18n {locale}:     {cov:.1f}%   (must be 100%)  [{'PASS' if ok_cov else 'FAIL'}]")

    print("=" * 50)
    if passed:
        print("BASELINE GATES: ALL PASSED")
    else:
        print("BASELINE GATES: FAILED")

    return passed


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate baseline report for wave planning")
    parser.add_argument("--output-dir", default=str(OUTPUT_DIR), help="Output folder")
    parser.add_argument("--output-prefix", default="baseline", help="Report filename prefix")
    parser.add_argument("--assert-gates", action="store_true", help="Compare against latest_baseline.json and exit 1 on regression")
    args = parser.parse_args()

    locales = ["en", "zh", "ja"]
    nodes = _load_nodes()

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_nodes": str(NODES_PATH),
        "quality": _quality_snapshot(nodes),
        "validation": _validate_snapshot(),
        "i18n_labels": _i18n_labels_snapshot(locales),
        "i18n_descriptions": _i18n_descriptions_snapshot(nodes, locales),
    }

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    json_path = output_dir / f"{args.output_prefix}_{stamp}.json"
    md_path = output_dir / f"{args.output_prefix}_{stamp}.md"
    latest_json = output_dir / "latest_baseline.json"
    latest_md = output_dir / "latest_baseline.md"

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(_render_markdown(report))

    with open(latest_json, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    with open(latest_md, "w", encoding="utf-8") as f:
        f.write(_render_markdown(report))

    print(f"baseline_json: {json_path}")
    print(f"baseline_md: {md_path}")
    print(f"latest_json: {latest_json}")
    print(f"latest_md: {latest_md}")

    if args.assert_gates:
        import sys
        prev_baseline = OUTPUT_DIR / "latest_baseline.json"
        if not _assert_gates(report, prev_baseline):
            # Write new baseline before exiting so CI artifacts show the regression
            sys.exit(1)


if __name__ == "__main__":
    main()
