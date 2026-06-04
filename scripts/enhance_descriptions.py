"""
enhance_descriptions.py
-----------------------
English description enhancement trial pipeline.

Goals:
  1. Select low-scoring nodes for a small pilot batch.
  2. Generate candidate descriptions using existing diagnostics.
  3. Re-score and validate candidates.
  4. Output review artifacts without mutating source node files.

Usage examples:
  python scripts/enhance_descriptions.py --limit 30
  python scripts/enhance_descriptions.py --limit 30 --model claude-haiku-4
  python scripts/enhance_descriptions.py --domain MAT --limit 20
"""

from __future__ import annotations

import argparse
import json
import os
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    from anthropic import Anthropic
except ImportError as exc:  # pragma: no cover - handled at runtime with clear message
    Anthropic = None
    IMPORT_ERROR = exc
else:
    IMPORT_ERROR = None

from quality_check import load_nodes, score_description, score_node


BASE_DIR = Path(__file__).parent.parent
OUTPUT_DEFAULT = BASE_DIR / "data" / "trial_enhancements.json"
SUMMARY_DEFAULT = BASE_DIR / "data" / "trial_enhancements_summary.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run description enhancement trial without overwriting node data")
    parser.add_argument("--limit", type=int, default=30, help="Max number of nodes to process")
    parser.add_argument("--domain", type=str, default=None, help="Optional domain filter, e.g. MAT")
    parser.add_argument(
        "--max-description-score",
        type=int,
        default=7,
        help="Select nodes with description score <= this value",
    )
    parser.add_argument(
        "--max-total-score",
        type=int,
        default=16,
        help="Select nodes with total node score <= this value",
    )
    parser.add_argument(
        "--model",
        type=str,
        default="claude-sonnet-4-6",
        help="Preferred Anthropic model for candidate generation",
    )
    parser.add_argument("--max-tokens", type=int, default=260, help="Max tokens per candidate generation call")
    parser.add_argument("--temperature", type=float, default=0.2, help="Sampling temperature")
    parser.add_argument("--output", type=Path, default=OUTPUT_DEFAULT, help="Detailed trial output JSON path")
    parser.add_argument("--summary", type=Path, default=SUMMARY_DEFAULT, help="Summary output JSON path")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Do not call LLM; only produce candidate list and prompts",
    )
    return parser.parse_args()


from nodus_utils import word_count  # noqa: E402


def build_selection_pool(nodes: list[dict[str, Any]], domain: str | None, max_desc_score: int, max_total_score: int) -> list[dict[str, Any]]:
    pool = []
    node_lookup = {node["id"]: node for node in nodes}
    for node in nodes:
        if domain and domain not in node.get("domain", []):
            continue

        desc_score = score_description(node)
        total_score = score_node(node, node_lookup)

        if desc_score["total"] <= max_desc_score and total_score["total_score"] <= max_total_score:
            item = {
                "node": node,
                "desc_score": desc_score,
                "total_score": total_score,
            }
            pool.append(item)

    pool.sort(key=lambda row: (row["desc_score"]["total"], row["total_score"]["total_score"], row["node"]["id"]))
    return pool


def prioritize_candidates(pool: list[dict[str, Any]], limit: int) -> list[dict[str, Any]]:
    # Favor mid-low quality nodes first for better repair potential.
    tier_1 = [row for row in pool if 5 <= row["desc_score"]["total"] <= 7]
    tier_2 = [row for row in pool if row["desc_score"]["total"] < 5]
    ordered = tier_1 + tier_2
    return ordered[:limit]


def build_repair_instructions(diags: list[str]) -> list[str]:
    mapped = []
    for diag in diags:
        d = diag.lower()
        if "what" in d:
            mapped.append("Strengthen WHAT: open with a precise definition sentence that clearly states what this concept/person/event/field is.")
        elif "significance" in d:
            mapped.append("Strengthen SIGNIFICANCE: include concrete impact language (e.g., enabled, transformed, foundational, breakthrough).")
        elif "bridge" in d:
            mapped.append("Strengthen BRIDGE: explicitly name at least one other domain and explain the cross-domain connection.")
        elif "lexical" in d:
            mapped.append("Improve lexical diversity: avoid repeating generic words and add concrete technical terms.")
        elif "specific" in d:
            mapped.append("Add specificity: include at least one concrete example, named method, or recognized historical detail.")

    if not mapped:
        mapped.append("Improve clarity and informativeness while preserving the original meaning.")

    # Keep stable order and remove duplicates.
    seen = set()
    unique = []
    for line in mapped:
        if line not in seen:
            unique.append(line)
            seen.add(line)
    return unique


def build_prompt(node: dict[str, Any], instructions: list[str]) -> str:
    nid = node.get("id", "")
    label = node.get("label", "")
    node_type = node.get("type", "")
    domains = ", ".join(node.get("domain", []))
    tags = ", ".join(node.get("display_tags", []))

    checklist = "\n".join(f"- {line}" for line in instructions)

    return (
        "You are editing a knowledge-graph node description in English.\n"
        "Rewrite the description to improve quality while preserving factual meaning.\n\n"
        "Constraints:\n"
        "- Output only the revised description text, no JSON, no bullets.\n"
        "- 50 to 100 words.\n"
        "- Keep it in English.\n"
        "- Keep the same topic and key terminology.\n"
        "- Ensure structure includes WHAT + SIGNIFICANCE + BRIDGE.\n"
        "- BRIDGE must explicitly mention at least one different domain.\n\n"
        "Node metadata:\n"
        f"- id: {nid}\n"
        f"- label: {label}\n"
        f"- type: {node_type}\n"
        f"- domains: {domains}\n"
        f"- display_tags: {tags}\n\n"
        "Quality repair instructions:\n"
        f"{checklist}\n\n"
        "Current description:\n"
        f"{node.get('description', '').strip()}"
    )


def clean_candidate_text(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        cleaned = cleaned.replace("json", "", 1).strip()
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned.strip()


def generate_candidate(
    client: Anthropic,
    model_candidates: list[str],
    max_tokens: int,
    temperature: float,
    prompt: str,
) -> tuple[str, str]:
    last_exc = None
    for model in model_candidates:
        try:
            response = client.messages.create(
                model=model,
                max_tokens=max_tokens,
                temperature=temperature,
                messages=[{"role": "user", "content": prompt}],
            )
            parts = []
            for block in response.content:
                if getattr(block, "type", None) == "text":
                    parts.append(getattr(block, "text", ""))
            return clean_candidate_text("\n".join(parts)), model
        except Exception as exc:  # pragma: no cover - network/runtime dependent
            # If model doesn't exist in this account/region, try next candidate.
            if "not_found_error" in str(exc) or "model:" in str(exc):
                last_exc = exc
                continue
            raise

    if last_exc is not None:
        raise last_exc
    raise RuntimeError("No model candidates provided")


def summarize(records: list[dict[str, Any]]) -> dict[str, Any]:
    scored = [r for r in records if r.get("candidate") and not r.get("errors")]
    improved = [r for r in scored if r["delta_description_score"] > 0]
    unchanged = [r for r in scored if r["delta_description_score"] == 0]
    regressed = [r for r in scored if r["delta_description_score"] < 0]

    diag_counter = Counter()
    for r in records:
        for d in r.get("diagnostics", []):
            diag_counter[d] += 1

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_records": len(records),
        "with_candidates": len(scored),
        "improved_count": len(improved),
        "unchanged_count": len(unchanged),
        "regressed_count": len(regressed),
        "improved_ratio": round(len(improved) / max(len(scored), 1), 3),
        "avg_delta_description_score": round(
            sum(r.get("delta_description_score", 0) for r in scored) / max(len(scored), 1),
            3,
        ),
        "top_diagnostics": diag_counter.most_common(10),
    }


def main() -> None:
    args = parse_args()
    nodes = load_nodes()

    pool = build_selection_pool(
        nodes=nodes,
        domain=args.domain,
        max_desc_score=args.max_description_score,
        max_total_score=args.max_total_score,
    )
    selected = prioritize_candidates(pool, args.limit)

    if not selected:
        print("No candidates found under current filters.")
        return

    if not args.dry_run and Anthropic is None:
        raise RuntimeError(
            f"anthropic import failed: {IMPORT_ERROR}. Install dependencies or run with --dry-run."
        )

    if not args.dry_run and not os.getenv("ANTHROPIC_API_KEY"):
        raise RuntimeError("ANTHROPIC_API_KEY is required for generation. Use --dry-run for diagnostics only.")

    client = Anthropic() if not args.dry_run else None

    model_candidates = [
        args.model,
        "claude-sonnet-4-6",
        "claude-haiku-4",
        "claude-3-5-haiku-20241022",
        "claude-3-5-sonnet-20241022",
    ]
    # Keep order while removing duplicates.
    model_candidates = list(dict.fromkeys(model_candidates))

    records: list[dict[str, Any]] = []
    print(f"Selected {len(selected)} candidate nodes (pool={len(pool)}).")

    for idx, item in enumerate(selected, start=1):
        node = item["node"]
        before = item["desc_score"]
        diagnostics = before.get("diagnostics", [])
        instructions = build_repair_instructions(diagnostics)
        prompt = build_prompt(node, instructions)

        record: dict[str, Any] = {
            "rank": idx,
            "node_id": node.get("id"),
            "label": node.get("label"),
            "domain": node.get("domain", []),
            "type": node.get("type"),
            "diagnostics": diagnostics,
            "repair_instructions": instructions,
            "original_description": node.get("description", ""),
            "original_word_count": word_count(node.get("description", "")),
            "original_description_score": before["total"],
            "original_description_breakdown": before["scores"],
            "prompt": prompt,
            "candidate": None,
            "candidate_word_count": None,
            "candidate_description_score": None,
            "candidate_description_breakdown": None,
            "delta_description_score": None,
            "used_model": None,
            "errors": [],
        }

        if args.dry_run:
            records.append(record)
            print(f"[{idx:02d}/{len(selected):02d}] {node.get('id')} prepared (dry-run)")
            continue

        try:
            candidate, used_model = generate_candidate(
                client=client,
                model_candidates=model_candidates,
                max_tokens=args.max_tokens,
                temperature=args.temperature,
                prompt=prompt,
            )
            candidate_wc = word_count(candidate)
            after = score_description({**node, "description": candidate})

            record["candidate"] = candidate
            record["candidate_word_count"] = candidate_wc
            record["candidate_description_score"] = after["total"]
            record["candidate_description_breakdown"] = after["scores"]
            record["delta_description_score"] = after["total"] - before["total"]
            record["used_model"] = used_model

            if candidate_wc < 50 or candidate_wc > 100:
                record["errors"].append(f"Candidate word count out of range: {candidate_wc}")

            if record["delta_description_score"] < 0:
                record["errors"].append("Candidate score regressed")

            print(
                f"[{idx:02d}/{len(selected):02d}] {node.get('id')} "
                f"{before['total']} -> {after['total']} (wc={candidate_wc}, model={used_model})"
            )
        except Exception as exc:  # pragma: no cover - network/runtime dependent
            record["errors"].append(f"Generation failed: {exc}")
            print(f"[{idx:02d}/{len(selected):02d}] {node.get('id')} failed: {exc}")

        records.append(record)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2)

    trial_summary = {
        "selection": {
            "domain": args.domain,
            "limit": args.limit,
            "max_description_score": args.max_description_score,
            "max_total_score": args.max_total_score,
            "pool_size": len(pool),
            "selected_size": len(selected),
            "dry_run": args.dry_run,
            "model": args.model,
        },
        "results": summarize(records),
        "output_file": str(args.output),
    }

    args.summary.parent.mkdir(parents=True, exist_ok=True)
    with open(args.summary, "w", encoding="utf-8") as f:
        json.dump(trial_summary, f, ensure_ascii=False, indent=2)

    print(f"\nWrote detailed trial records: {args.output}")
    print(f"Wrote trial summary: {args.summary}")


if __name__ == "__main__":
    main()
