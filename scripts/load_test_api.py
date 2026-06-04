"""Simple API load test for P2 capacity/caching baseline.

Usage:
  python scripts/load_test_api.py --base-url http://127.0.0.1:8000 --requests 40 --concurrency 8
"""

from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path
import statistics
import time
from dataclasses import dataclass
from datetime import datetime, timezone

import httpx


@dataclass
class Sample:
    status_code: int
    latency_ms: float


async def _hit(client: httpx.AsyncClient, path: str, params: dict | None = None) -> Sample:
    started = time.perf_counter()
    resp = await client.get(path, params=params)
    latency_ms = (time.perf_counter() - started) * 1000
    return Sample(status_code=resp.status_code, latency_ms=latency_ms)


async def _run_scenario(
    client: httpx.AsyncClient,
    path: str,
    params: dict | None,
    total_requests: int,
    concurrency: int,
) -> list[Sample]:
    semaphore = asyncio.Semaphore(concurrency)

    async def worker() -> Sample:
        async with semaphore:
            return await _hit(client, path=path, params=params)

    tasks = [asyncio.create_task(worker()) for _ in range(total_requests)]
    return await asyncio.gather(*tasks)


def _percentile(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    idx = int((len(ordered) - 1) * p)
    return ordered[idx]


def _summarize(name: str, samples: list[Sample]) -> None:
    latencies = [s.latency_ms for s in samples]
    non_2xx = [s.status_code for s in samples if s.status_code < 200 or s.status_code >= 300]

    print(f"\n=== {name} ===")
    print(f"requests: {len(samples)}")
    print(f"non_2xx: {len(non_2xx)}")
    print(f"avg_ms: {statistics.fmean(latencies):.1f}")
    print(f"p95_ms: {_percentile(latencies, 0.95):.1f}")
    print(f"max_ms: {max(latencies):.1f}")


def _scenario_summary(samples: list[Sample]) -> dict:
    latencies = [s.latency_ms for s in samples]
    non_2xx = [s.status_code for s in samples if s.status_code < 200 or s.status_code >= 300]
    return {
        "requests": len(samples),
        "non_2xx": len(non_2xx),
        "avg_ms": round(statistics.fmean(latencies), 2),
        "p95_ms": round(_percentile(latencies, 0.95), 2),
        "max_ms": round(max(latencies), 2),
    }


def _write_benchmark_reports(output_dir: Path, output_prefix: str, report: dict) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)

    json_path = output_dir / f"{output_prefix}.json"
    md_path = output_dir / f"{output_prefix}.md"
    latest_json_path = output_dir / "latest.json"
    latest_md_path = output_dir / "latest.md"

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    with open(latest_json_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    lines = [
        "# Nodus API Benchmark",
        "",
        f"- timestamp: {report['timestamp']}",
        f"- base_url: {report['base_url']}",
        f"- requests: {report['requests']}",
        f"- concurrency: {report['concurrency']}",
        "",
        "## First Hit",
        "",
        f"- graph_first_ms: {report['first_hit']['graph_first_ms']} (status={report['first_hit']['graph_status']})",
        f"- search_first_ms: {report['first_hit']['search_first_ms']} (status={report['first_hit']['search_status']})",
        "",
        "## Scenarios",
        "",
    ]

    for name in ("graph_subgraph", "search"):
        summary = report["scenarios"][name]
        lines.extend(
            [
                f"### {name}",
                "",
                f"- requests: {summary['requests']}",
                f"- non_2xx: {summary['non_2xx']}",
                f"- avg_ms: {summary['avg_ms']}",
                f"- p95_ms: {summary['p95_ms']}",
                f"- max_ms: {summary['max_ms']}",
                "",
            ]
        )

    md_content = "\n".join(lines)
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(md_content)
    with open(latest_md_path, "w", encoding="utf-8") as f:
        f.write(md_content)

    print(f"\nbenchmark_json: {json_path}")
    print(f"benchmark_md: {md_path}")


async def main() -> None:
    parser = argparse.ArgumentParser(description="Nodus API load and warm-cache baseline")
    parser.add_argument("--base-url", default="http://127.0.0.1:8000", help="Base API host URL")
    parser.add_argument("--requests", type=int, default=40, help="Requests per scenario")
    parser.add_argument("--concurrency", type=int, default=8, help="Concurrent workers")
    parser.add_argument("--output-dir", default="", help="Write JSON/MD reports to this directory")
    parser.add_argument("--output-prefix", default="", help="Output filename prefix (without extension)")
    args = parser.parse_args()

    async with httpx.AsyncClient(base_url=args.base_url, timeout=30.0) as client:
        health = await _hit(client, "/api/health")
        if health.status_code != 200:
            raise RuntimeError(f"Health check failed with status {health.status_code}")

        # Cold-ish single requests to capture first-hit behavior.
        graph_first = await _hit(client, "/api/graph/subgraph", {"center": "physics_field", "depth": 2})
        search_first = await _hit(client, "/api/search", {"q": "quantum", "limit": 20})

        print("=== first_hit ===")
        print(f"graph_first_ms: {graph_first.latency_ms:.1f} (status={graph_first.status_code})")
        print(f"search_first_ms: {search_first.latency_ms:.1f} (status={search_first.status_code})")

        graph_samples = await _run_scenario(
            client,
            path="/api/graph/subgraph",
            params={"center": "physics_field", "depth": 2},
            total_requests=args.requests,
            concurrency=args.concurrency,
        )
        _summarize("graph_subgraph", graph_samples)

        search_samples = await _run_scenario(
            client,
            path="/api/search",
            params={"q": "quantum", "limit": 20},
            total_requests=args.requests,
            concurrency=args.concurrency,
        )
        _summarize("search", search_samples)

        report = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "base_url": args.base_url,
            "requests": args.requests,
            "concurrency": args.concurrency,
            "first_hit": {
                "graph_first_ms": round(graph_first.latency_ms, 2),
                "graph_status": graph_first.status_code,
                "search_first_ms": round(search_first.latency_ms, 2),
                "search_status": search_first.status_code,
            },
            "scenarios": {
                "graph_subgraph": _scenario_summary(graph_samples),
                "search": _scenario_summary(search_samples),
            },
        }

        if args.output_dir:
            output_dir = Path(args.output_dir)
            prefix = args.output_prefix.strip() or datetime.now(timezone.utc).strftime("benchmark_%Y%m%d_%H%M%S")
            _write_benchmark_reports(output_dir=output_dir, output_prefix=prefix, report=report)


if __name__ == "__main__":
    asyncio.run(main())
