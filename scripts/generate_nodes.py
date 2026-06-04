"""
generate_nodes.py
-----------------
批量生成知識圖譜節點。
使用 Claude API 根據 generation_prompt_v2.md 的規則生成節點。

使用方法：
  python generate_nodes.py --phase 2 --domain MAT --subdomain calculus --batch_size 20
  python generate_nodes.py --phase 2 --domain MAT --subdomain calculus --batches 5 --resume

需要先設定環境變數：
  export ANTHROPIC_API_KEY=your_key_here
"""

import json
import os
import re
import argparse
import time
from pathlib import Path
from datetime import datetime, timezone
from difflib import SequenceMatcher

import yaml
from anthropic import Anthropic, RateLimitError, APIConnectionError, APIStatusError

# ── 路徑設定 ──────────────────────────────────────────
BASE_DIR = Path(__file__).parent.parent
CONFIG_FILE = BASE_DIR / "config.yaml"

def load_config():
    with open(CONFIG_FILE, encoding="utf-8") as f:
        return yaml.safe_load(f)

CONFIG = load_config()

DATA_DIR = BASE_DIR / "data"
NODES_FILE = BASE_DIR / CONFIG["paths"]["nodes_file"]
FIELD_NODES_FILE = BASE_DIR / CONFIG["paths"]["field_nodes_file"]
TAGS_FILE = BASE_DIR / CONFIG["paths"]["tags_file"]
PROMPT_FILE = BASE_DIR / CONFIG["paths"]["prompt_file"]
BATCH_DIR = BASE_DIR / CONFIG["paths"]["batch_dir"]
LOG_FILE = BASE_DIR / CONFIG["paths"]["log_file"]

from nodus_utils import VALID_DOMAINS

# ── 載入現有節點 ───────────────────────────────────────
def load_existing_nodes():
    nodes = []
    if NODES_FILE.exists():
        with open(NODES_FILE, encoding="utf-8") as f:
            data = json.load(f)
            nodes = data.get("nodes", [])
    elif FIELD_NODES_FILE.exists():
        with open(FIELD_NODES_FILE, encoding="utf-8") as f:
            data = json.load(f)
            nodes = data.get("nodes", [])
    
    if not nodes:
        print("⚠️  Warning: No existing nodes loaded. Starting from empty graph.")
    
    return nodes

# ── 載入 prompt 模板 ───────────────────────────────────
def load_prompt_template():
    with open(PROMPT_FILE, encoding="utf-8") as f:
        return f.read()

# ── 載入種子標籤（取相關子集） ──────────────────────────
def load_seed_tags(domain: str):
    with open(TAGS_FILE, encoding="utf-8") as f:
        data = json.load(f)
    
    domain_map = {
        "MAT": ["mathematics_subfields", "concept_nature", "special_attributes"],
        "PHY": ["physics_subfields", "concept_nature", "scale_and_scope"],
        "CHE": ["chemistry_subfields", "concept_nature", "scale_and_scope"],
        "BIO": ["biology_subfields", "concept_nature", "scale_and_scope"],
        "MED": ["medicine_subfields", "concept_nature", "application_domain"],
        "ENG": ["engineering_subfields", "concept_nature", "application_domain"],
        "TEC": ["technology_subfields", "concept_nature", "application_domain"],
        "SOC": ["social_science_subfields", "concept_nature", "era_fine"],
        "HUM": ["humanities_subfields", "concept_nature", "geography_civilization"],
        "PHI": ["philosophy_subfields", "concept_nature", "era_coarse"],
        "ART": ["arts_subfields", "concept_nature", "era_fine"],
        "HIS": ["history_subfields", "era_fine", "geography_civilization"],
    }
    
    categories = domain_map.get(domain, ["concept_nature", "special_attributes"])
    categories += ["era_coarse", "era_fine", "geography_region", "special_attributes", "person_role"]
    
    tags = []
    for cat in set(categories):
        if cat in data["categories"]:
            tags.extend(data["categories"][cat])
    
    return list(set(tags))[:150]

# ── 分層抽樣 context 節點 ─────────────────────────────
def build_context_ids(existing_nodes: list) -> list:
    """
    分層抽樣策略：
    1. 所有 field nodes（作為 anchor，始終包含）
    2. 每個 domain 取最近 N 個非 field 節點（確保 12 領域均有代表）
    3. 總數不超過 context_max_ids
    
    回傳 [{id, type, domain}] 而非僅 ID，讓 LLM 能判斷跨域連結。
    """
    max_ids = CONFIG["generation"]["context_max_ids"]
    per_domain = CONFIG["generation"]["context_per_domain"]
    
    field_nodes = [n for n in existing_nodes if n["type"] == "field"]
    other_nodes = [n for n in existing_nodes if n["type"] != "field"]
    
    # 所有 field nodes 的精簡資訊
    context = [{"id": n["id"], "type": n["type"], "domain": n.get("domain", [])} 
               for n in field_nodes]
    
    # 如果 field nodes 已經超過上限，截斷
    if len(context) >= max_ids:
        context = context[:max_ids]
        return context
    
    remaining = max_ids - len(context)
    
    # 按 domain 分組（一個 node 可能屬於多個 domain）
    by_domain = {d: [] for d in VALID_DOMAINS}
    for n in other_nodes:
        for d in n.get("domain", []):
            if d in by_domain:
                by_domain[d].append(n)
    
    # 每個 domain 取最近的 per_domain 個
    selected_ids = set(c["id"] for c in context)
    per_domain_actual = min(per_domain, remaining // 12)
    
    for domain in VALID_DOMAINS:
        candidates = by_domain[domain]
        for n in candidates[-per_domain_actual:]:
            if n["id"] not in selected_ids and len(context) < max_ids:
                context.append({"id": n["id"], "type": n["type"], "domain": n.get("domain", [])})
                selected_ids.add(n["id"])
    
    # 如果還有空間，補充最近生成的（不分 domain）
    for n in reversed(other_nodes):
        if n["id"] not in selected_ids and len(context) < max_ids:
            context.append({"id": n["id"], "type": n["type"], "domain": n.get("domain", [])})
            selected_ids.add(n["id"])
    
    return context

# ── 建立生成 prompt ────────────────────────────────────
def build_prompt(phase: int, domain: str, subdomain: str, 
                 batch_size: int, batch_number: int, existing_nodes: list):
    
    template = load_prompt_template()
    seed_tags = load_seed_tags(domain)
    context_nodes = build_context_ids(existing_nodes)
    
    context = f"""
---
CONTEXT FOR THIS GENERATION CALL:

PROMPT_VERSION: 2.0
GENERATION_PHASE: {phase}
TARGET_DOMAIN: {domain}
TARGET_SUBDOMAIN: {subdomain}
BATCH_SIZE: {batch_size}
BATCH_NUMBER: {batch_number}

EXISTING_NODES ({len(context_nodes)} entries with metadata):
{json.dumps(context_nodes, indent=None, ensure_ascii=False)}

SEED_TAGS (relevant subset):
{json.dumps(seed_tags, indent=None)}

---
Now generate exactly {batch_size} nodes following all rules above.
Return only valid JSON with no other text.
"""
    
    return template + context

# ── JSON 解析（robust） ────────────────────────────────
def extract_json(raw: str) -> dict:
    """
    從 Claude 回應中提取 JSON，處理各種格式：
    1. 純 JSON
    2. ```json ... ``` 包裹
    3. ``` ... ``` 包裹
    4. 前後有文字噪音
    """
    raw = raw.strip()
    
    # 嘗試 1：直接解析
    if raw.startswith("{"):
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            pass
    
    # 嘗試 2：用 regex 提取 fenced code block 內容
    fence_pattern = re.compile(r"```(?:json)?\s*\n?(.*?)\n?\s*```", re.DOTALL)
    match = fence_pattern.search(raw)
    if match:
        try:
            return json.loads(match.group(1).strip())
        except json.JSONDecodeError:
            pass
    
    # 嘗試 3：找最外層的 { ... }
    brace_start = raw.find("{")
    brace_end = raw.rfind("}")
    if brace_start != -1 and brace_end > brace_start:
        try:
            return json.loads(raw[brace_start:brace_end + 1])
        except json.JSONDecodeError:
            pass
    
    # 全部失敗
    raise json.JSONDecodeError("Cannot extract valid JSON from response", raw, 0)


# ── Structured Output Schema（tool_use 模式）──────────
NODE_SCHEMA = {
    "name": "generate_knowledge_nodes",
    "description": "Generate knowledge graph nodes following the Nodus schema.",
    "input_schema": {
        "type": "object",
        "properties": {
            "nodes": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "string", "description": "Unique ID: descriptive_name_type"},
                        "label": {"type": "string", "description": "English title case label"},
                        "type": {"type": "string", "enum": ["concept", "person", "event", "field"]},
                        "domain": {"type": "array", "items": {"type": "string"}},
                        "display_tags": {"type": "array", "items": {"type": "string"}},
                        "description": {"type": "string", "description": "50-100 words with WHAT + SIGNIFICANCE + BRIDGE"},
                        "era": {
                            "type": "object",
                            "properties": {
                                "start": {"type": ["integer", "null"]},
                                "end": {"type": ["integer", "null"]}
                            },
                            "required": ["start", "end"]
                        },
                        "geo": {"type": ["array", "null"], "items": {"type": "string"}},
                        "has_subgraph": {"type": "boolean"},
                        "verified": {"type": "boolean"},
                        "schema_version": {"type": "integer"},
                        "connections": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "target": {"type": "string"},
                                    "relation_type": {"type": "string", "enum": ["logical", "historical", "causal", "applied", "conceptual"]},
                                    "relation": {"type": "string"},
                                    "directed": {"type": "boolean"},
                                    "learning_prerequisite": {"type": "boolean"},
                                    "parallel_development": {"type": "boolean"},
                                    "pending": {"type": "boolean"}
                                },
                                "required": ["target", "relation_type", "relation", "directed"]
                            }
                        }
                    },
                    "required": ["id", "label", "type", "domain", "display_tags", "description", "era", "connections"]
                }
            }
        },
        "required": ["nodes"]
    }
}

# ── LLM 自我批判（品質把關） ────────────────────────────
CRITIQUE_PROMPT = """You are a strict quality reviewer for a knowledge graph. Review these generated nodes and score each one.

For each node, check:
1. WHAT: Does the first sentence clearly define what this is? (0-3)
2. SIGNIFICANCE: Does the description explain WHY it matters with impact language? (0-3)
3. BRIDGE: Does the description explicitly mention a connection to a DIFFERENT domain by name? (0-4)
4. CONNECTION_QUALITY: Are the relation texts specific and informative (not generic)? (0-3)
5. CROSS_DOMAIN: Do connections span multiple different domains? (0-2)

Total max: 15 points. Nodes scoring below 10 should be flagged for rejection.

Return ONLY valid JSON in this format:
{
  "reviews": [
    {"id": "node_id", "score": 12, "issues": ["SIGNIFICANCE weak"], "reject": false},
    {"id": "node_id", "score": 8, "issues": ["No BRIDGE", "Generic relations"], "reject": true}
  ]
}

NODES TO REVIEW:
"""

def critique_nodes(nodes: list) -> tuple:
    """
    用 LLM 進行品質自審（使用 Haiku 模型以降低成本）。
    回傳 (accepted_nodes, rejected_nodes, critique_usage)
    """
    if not nodes:
        return [], [], {"input_tokens": 0, "output_tokens": 0}
    
    client = Anthropic()
    gen_cfg = CONFIG["generation"]
    critique_model = gen_cfg.get("critique_model", "claude-haiku-4")
    
    # 只傳必要欄位給 critique
    slim_nodes = []
    for n in nodes:
        slim_nodes.append({
            "id": n["id"],
            "label": n.get("label"),
            "domain": n.get("domain"),
            "description": n.get("description"),
            "connections": [
                {"target": c["target"], "relation_type": c.get("relation_type"), "relation": c.get("relation", "")}
                for c in n.get("connections", [])
            ]
        })
    
    prompt = CRITIQUE_PROMPT + json.dumps(slim_nodes, ensure_ascii=False, indent=1)
    
    try:
        message = client.messages.create(
            model=critique_model,
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}]
        )
        
        raw = message.content[0].text.strip()
        result = extract_json(raw)
        usage = {
            "input_tokens": message.usage.input_tokens,
            "output_tokens": message.usage.output_tokens,
        }
        
        reviews = {r["id"]: r for r in result.get("reviews", [])}
        
        accepted = []
        rejected = []
        for n in nodes:
            review = reviews.get(n["id"])
            if review and review.get("reject"):
                rejected.append({"node": n, "review": review})
            else:
                accepted.append(n)
        
        return accepted, rejected, usage
        
    except Exception as e:
        # Critique 失敗不阻塞生成 — 全部接受
        print(f"  [WARN] Critique call failed ({type(e).__name__}), accepting all nodes")
        return nodes, [], {"input_tokens": 0, "output_tokens": 0}


# ── 即時輕量去重 ───────────────────────────────────────
def quick_dedup_check(new_nodes: list, existing_nodes: list, threshold: float = None) -> tuple:
    """
    在寫入前進行輕量字串去重。
    回傳 (clean_nodes, flagged_pairs)
    """
    if threshold is None:
        threshold = CONFIG["deduplication"]["string_threshold"]
    
    existing_labels = {n["id"]: n["label"] for n in existing_nodes}
    clean = []
    flagged = []
    
    for node in new_nodes:
        is_dup = False
        for eid, elabel in existing_labels.items():
            score = SequenceMatcher(None, node["label"].lower(), elabel.lower()).ratio()
            if score >= threshold:
                flagged.append({
                    "new_id": node["id"],
                    "new_label": node["label"],
                    "existing_id": eid,
                    "existing_label": elabel,
                    "score": round(score, 3)
                })
                is_dup = True
                break
        if not is_dup:
            clean.append(node)
    
    return clean, flagged

# ── 呼叫 Claude API（含重試 + Prompt Caching） ─────────
def call_claude(prompt: str, batch_size: int, structured: bool = False) -> tuple:
    """
    呼叫 Claude API，含指數退避重試與 prompt caching。
    將不變的 prompt template 放入 system（啟用 cache），
    僅將動態 context 放入 user message。
    
    structured=True 時使用 tool_use 模式保證有效 JSON 輸出。
    回傳 (parsed_result, usage_dict)
    """
    client = Anthropic()
    retry_cfg = CONFIG["retry"]
    gen_cfg = CONFIG["generation"]
    
    max_tokens = gen_cfg["max_tokens_base"] + gen_cfg["max_tokens_per_node"] * batch_size
    
    # 分離 system prompt (cacheable) 與 user context (variable)
    # prompt 格式為: template + "\n---\nCONTEXT FOR THIS GENERATION CALL:..." 
    separator = "\n---\nCONTEXT FOR THIS GENERATION CALL:"
    if separator in prompt:
        system_part = prompt[:prompt.index(separator)]
        user_part = prompt[prompt.index(separator):]
    else:
        system_part = ""
        user_part = prompt
    
    # 構建帶 cache_control 的 system message
    system_messages = []
    if system_part:
        system_messages = [{
            "type": "text",
            "text": system_part,
            "cache_control": {"type": "ephemeral"}
        }]
    
    # Structured output: use tool_use to guarantee valid JSON
    tools = [NODE_SCHEMA] if structured else []
    tool_choice = {"type": "tool", "name": "generate_knowledge_nodes"} if structured else None
    
    for attempt in range(1, retry_cfg["max_attempts"] + 1):
        try:
            kwargs = {
                "model": gen_cfg["model"],
                "max_tokens": max_tokens,
                "system": system_messages if system_messages else [],
                "messages": [{"role": "user", "content": user_part}],
            }
            if structured:
                kwargs["tools"] = tools
                kwargs["tool_choice"] = tool_choice
            
            message = client.messages.create(**kwargs)
            
            # Parse response based on mode
            if structured:
                # tool_use mode: extract from tool call input
                tool_block = next(
                    (b for b in message.content if b.type == "tool_use"), None
                )
                if not tool_block:
                    raise ValueError("No tool_use block in structured response")
                result = tool_block.input
            else:
                # Text mode: extract JSON from text
                raw = ""
                if message.content:
                    raw = message.content[0].text.strip()
                if not raw:
                    print(f"  [DEBUG] Empty response. Stop reason: {message.stop_reason}, content blocks: {len(message.content) if message.content else 0}")
                    raise ValueError("Empty API response")
                result = extract_json(raw)
            
            usage = {
                "input_tokens": message.usage.input_tokens,
                "output_tokens": message.usage.output_tokens,
            }
            
            return result, usage
            
        except (RateLimitError, APIConnectionError) as e:
            if attempt < retry_cfg["max_attempts"]:
                wait = min(retry_cfg["backoff_base"] ** attempt, retry_cfg["backoff_max"])
                print(f"  ⚠️  Retryable error (attempt {attempt}/{retry_cfg['max_attempts']}): {type(e).__name__}")
                print(f"     Waiting {wait:.1f}s before retry...")
                time.sleep(wait)
            else:
                raise
                
        except APIStatusError as e:
            if e.status_code in retry_cfg["retryable_status_codes"]:
                if attempt < retry_cfg["max_attempts"]:
                    wait = min(retry_cfg["backoff_base"] ** attempt, retry_cfg["backoff_max"])
                    print(f"  ⚠️  Retryable HTTP {e.status_code} (attempt {attempt}/{retry_cfg['max_attempts']})")
                    print(f"     Waiting {wait:.1f}s before retry...")
                    time.sleep(wait)
                else:
                    raise
            else:
                raise

# ── 成本追蹤 ───────────────────────────────────────────
def log_generation(phase: int, domain: str, subdomain: str, batch_number: int,
                   nodes_generated: int, nodes_added: int, nodes_skipped: int,
                   nodes_deduped: int, usage: dict, status: str, error: str = None):
    """將每次生成的結果寫入 JSONL log"""
    cost_cfg = CONFIG["cost_tracking"]
    if not cost_cfg["enabled"]:
        return
    
    input_cost = (usage.get("input_tokens", 0) / 1_000_000) * cost_cfg["input_cost_per_mtok"]
    output_cost = (usage.get("output_tokens", 0) / 1_000_000) * cost_cfg["output_cost_per_mtok"]
    
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "phase": phase,
        "domain": domain,
        "subdomain": subdomain,
        "batch_number": batch_number,
        "nodes_generated": nodes_generated,
        "nodes_added": nodes_added,
        "nodes_skipped": nodes_skipped,
        "nodes_deduped": nodes_deduped,
        "input_tokens": usage.get("input_tokens", 0),
        "output_tokens": usage.get("output_tokens", 0),
        "cost_usd": round(input_cost + output_cost, 6),
        "status": status,
        "error": error,
    }
    
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    
    # 累計成本警告
    total_cost = get_total_cost()
    if total_cost > cost_cfg["budget_warning_usd"]:
        print(f"  💰 Budget warning: total cost ${total_cost:.4f} exceeds ${cost_cfg['budget_warning_usd']:.2f}")

def get_total_cost() -> float:
    if not LOG_FILE.exists():
        return 0.0
    total = 0.0
    with open(LOG_FILE) as f:
        for line in f:
            if line.strip():
                entry = json.loads(line)
                total += entry.get("cost_usd", 0)
    return total

# ── 批次存檔（斷點續傳） ──────────────────────────────
def save_batch(nodes: list, phase: int, domain: str, subdomain: str, batch_number: int):
    """每批結果獨立存檔，支援斷點續傳"""
    BATCH_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"phase{phase}_{domain}_{subdomain}_batch{batch_number:03d}.json"
    filepath = BATCH_DIR / filename
    
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump({
            "meta": {
                "phase": phase,
                "domain": domain,
                "subdomain": subdomain,
                "batch_number": batch_number,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "count": len(nodes)
            },
            "nodes": nodes
        }, f, ensure_ascii=False, indent=2)
    
    return filepath

def get_last_batch_number(phase: int, domain: str, subdomain: str) -> int:
    """查詢已完成的最大 batch number（用於 --resume）"""
    if not BATCH_DIR.exists():
        return 0
    
    pattern = f"phase{phase}_{domain}_{subdomain}_batch*.json"
    existing = sorted(BATCH_DIR.glob(pattern))
    if not existing:
        return 0
    
    last = existing[-1].stem
    match = re.search(r"batch(\d+)", last)
    return int(match.group(1)) if match else 0

# ── 儲存節點 ───────────────────────────────────────────
def save_nodes(new_nodes: list, existing_nodes: list):
    """去重並寫入主檔案"""
    existing_ids = {n["id"] for n in existing_nodes}
    added = []
    skipped = []
    
    for node in new_nodes:
        if node["id"] in existing_ids:
            skipped.append(node["id"])
        else:
            existing_nodes.append(node)
            existing_ids.add(node["id"])
            added.append(node["id"])
    
    NODES_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(NODES_FILE, "w", encoding="utf-8") as f:
        json.dump({
            "meta": {"total": len(existing_nodes)},
            "nodes": existing_nodes
        }, f, ensure_ascii=False, indent=2)
    
    return added, skipped

# ── 主程式 ─────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Generate knowledge graph nodes")
    parser.add_argument("--phase", type=int, default=2, help="Generation phase (1-5)")
    parser.add_argument("--domain", type=str, default="MAT", help="Domain code")
    parser.add_argument("--subdomain", type=str, default="calculus", help="Subdomain tag")
    parser.add_argument("--batch_size", type=int, default=None, help="Nodes per batch (max 20)")
    parser.add_argument("--batches", type=int, default=None, help="Number of batches to run")
    parser.add_argument("--delay", type=float, default=None, help="Seconds between batches")
    parser.add_argument("--resume", action="store_true", help="Resume from last completed batch")
    parser.add_argument("--dry-run", action="store_true", help="Build prompt but don't call API")
    parser.add_argument("--critique", action="store_true", help="Enable LLM self-critique quality gate")
    parser.add_argument("--structured", action="store_true", help="Use tool_use mode for guaranteed valid JSON output")
    args = parser.parse_args()
    
    # 從 config 取預設值，CLI 可覆蓋
    gen_cfg = CONFIG["generation"]
    batch_size = args.batch_size or gen_cfg["batch_size"]
    batches = args.batches or gen_cfg["batches"]
    delay = args.delay if args.delay is not None else gen_cfg["delay_between_batches"]
    
    if not args.dry_run and not os.environ.get("ANTHROPIC_API_KEY"):
        print("❌ Error: ANTHROPIC_API_KEY environment variable not set")
        return
    
    if args.domain not in VALID_DOMAINS:
        print(f"❌ Error: Invalid domain '{args.domain}'. Must be one of: {sorted(VALID_DOMAINS)}")
        return
    
    existing_nodes = load_existing_nodes()
    print(f"📦 Loaded {len(existing_nodes)} existing nodes")
    print(f"🎯 Target: Phase {args.phase}, {args.domain}/{args.subdomain}, {batch_size} nodes × {batches} batches")
    
    # 斷點續傳
    start_batch = 1
    if args.resume:
        last_done = get_last_batch_number(args.phase, args.domain, args.subdomain)
        if last_done > 0:
            start_batch = last_done + 1
            print(f"🔄 Resuming from batch {start_batch} (last completed: {last_done})")
    
    total_added = []
    total_skipped = []
    total_deduped = []
    total_usage = {"input_tokens": 0, "output_tokens": 0}
    
    for batch_num in range(start_batch, start_batch + batches):
        print(f"\n{'─'*50}")
        print(f"Batch {batch_num} — Phase {args.phase}, {args.domain}/{args.subdomain}")
        
        prompt = build_prompt(
            phase=args.phase,
            domain=args.domain,
            subdomain=args.subdomain,
            batch_size=batch_size,
            batch_number=batch_num,
            existing_nodes=existing_nodes
        )
        
        if args.dry_run:
            print(f"  [DRY RUN] Prompt length: {len(prompt)} chars")
            print(f"  [DRY RUN] Context nodes: {len(build_context_ids(existing_nodes))}")
            continue
        
        try:
            result, usage = call_claude(prompt, batch_size, structured=args.structured)
            total_usage["input_tokens"] += usage.get("input_tokens", 0)
            total_usage["output_tokens"] += usage.get("output_tokens", 0)
            
            new_nodes = result.get("nodes", [])
            print(f"  Generated: {len(new_nodes)} nodes")
            print(f"  Tokens: {usage.get('input_tokens', 0)} in / {usage.get('output_tokens', 0)} out")
            
            # B3: 即時輕量去重
            clean_nodes, flagged = quick_dedup_check(new_nodes, existing_nodes)
            if flagged:
                print(f"  [DEDUP] Flagged {len(flagged)} similar nodes:")
                for f_item in flagged:
                    print(f"     [{f_item['score']}] '{f_item['new_label']}' ~ '{f_item['existing_label']}'")
                total_deduped.extend([f["new_id"] for f in flagged])
            
            # LLM 自我批判（可選）
            rejected_nodes = []
            if args.critique and clean_nodes:
                print(f"  [CRITIQUE] Reviewing {len(clean_nodes)} nodes...")
                clean_nodes, rejected_nodes, critique_usage = critique_nodes(clean_nodes)
                total_usage["input_tokens"] += critique_usage.get("input_tokens", 0)
                total_usage["output_tokens"] += critique_usage.get("output_tokens", 0)
                if rejected_nodes:
                    print(f"  [CRITIQUE] Rejected {len(rejected_nodes)} low-quality nodes:")
                    for rej in rejected_nodes:
                        print(f"     X {rej['node']['id']} (score={rej['review'].get('score',0)}): {rej['review'].get('issues',[])}")
                else:
                    print(f"  [CRITIQUE] All {len(clean_nodes)} nodes passed quality gate")
            
            # 存檔
            added, skipped = save_nodes(clean_nodes, existing_nodes)
            total_added.extend(added)
            total_skipped.extend(skipped)
            
            # 批次獨立存檔
            save_batch(clean_nodes, args.phase, args.domain, args.subdomain, batch_num)
            
            print(f"  [OK] Added: {len(added)}, Skipped: {len(skipped)}, Deduped: {len(flagged)}, Rejected: {len(rejected_nodes)}")
            
            # 記錄 log
            log_generation(
                phase=args.phase, domain=args.domain, subdomain=args.subdomain,
                batch_number=batch_num, nodes_generated=len(new_nodes),
                nodes_added=len(added), nodes_skipped=len(skipped),
                nodes_deduped=len(flagged), usage=usage, status="success"
            )
            
        except json.JSONDecodeError as e:
            print(f"  ❌ Error: Invalid JSON response — {e}")
            log_generation(
                phase=args.phase, domain=args.domain, subdomain=args.subdomain,
                batch_number=batch_num, nodes_generated=0, nodes_added=0,
                nodes_skipped=0, nodes_deduped=0, usage=total_usage,
                status="error", error=f"JSONDecodeError: {e}"
            )
            
        except (RateLimitError, APIConnectionError, APIStatusError) as e:
            print(f"  ❌ API Error after retries: {type(e).__name__} — {e}")
            log_generation(
                phase=args.phase, domain=args.domain, subdomain=args.subdomain,
                batch_number=batch_num, nodes_generated=0, nodes_added=0,
                nodes_skipped=0, nodes_deduped=0, usage=total_usage,
                status="error", error=f"{type(e).__name__}: {e}"
            )
            print(f"  Stopping generation due to API error.")
            break
            
        except Exception as e:
            print(f"  ❌ Unexpected error: {type(e).__name__} — {e}")
            log_generation(
                phase=args.phase, domain=args.domain, subdomain=args.subdomain,
                batch_number=batch_num, nodes_generated=0, nodes_added=0,
                nodes_skipped=0, nodes_deduped=0, usage=total_usage,
                status="error", error=f"{type(e).__name__}: {e}"
            )
        
        # 批次間延遲
        if batch_num < start_batch + batches - 1:
            print(f"  Waiting {delay}s before next batch...")
            time.sleep(delay)
    
    # 最終摘要
    print(f"\n{'='*50}")
    print(f"GENERATION SUMMARY")
    print(f"{'='*50}")
    print(f"Total added:   {len(total_added)}")
    print(f"Total skipped: {len(total_skipped)} (ID collision)")
    print(f"Total deduped: {len(total_deduped)} (label similarity)")
    print(f"Total tokens:  {total_usage['input_tokens']} in / {total_usage['output_tokens']} out")
    
    cost_cfg = CONFIG["cost_tracking"]
    est_cost = ((total_usage["input_tokens"] / 1_000_000) * cost_cfg["input_cost_per_mtok"] +
                (total_usage["output_tokens"] / 1_000_000) * cost_cfg["output_cost_per_mtok"])
    print(f"Est. cost:     ${est_cost:.4f}")
    print(f"Cumulative:    ${get_total_cost():.4f}")

if __name__ == "__main__":
    main()
