## Nodus — AI Agent Instructions

This is an educational knowledge graph tool for linku.tech. Target users include children (age 8+).

### Core Constraints

1. **Minimalism** — Do not over-engineer. No frameworks, no unnecessary abstractions.
2. **No gamification** — No XP, badges, streaks, achievements, leaderboards, or social features.
3. **No accounts** — Progress stored in localStorage only. No login/signup flows.
4. **Touch-first** — All interactive elements must be ≥ 44px touch target.
5. **One click = one action** — Never require key combinations (Shift+Click, Ctrl+Click) for core features.

### Before Any Change

- Read `ARCHITECTURE.md` for immutable principles and protected files list.
- Read `CONTRIBUTING.md` for the change checklist.
- Run `npm run build` + `python -m pytest tests -q` to verify nothing breaks.
- Do NOT add dependencies unless absolutely unavoidable.
- Do NOT refactor code that isn't part of the current task.

### Tech Stack (Do Not Change)

- Frontend: Vanilla JS + D3.js + Vite
- Backend: FastAPI + JSON file service
- Data: `data/all_nodes.json` (627 nodes)
- Tests: Playwright (E2E) + pytest (API contracts)

### Style Rules

- CSS: Use existing custom properties (`--accent`, `--bg-0`, `--ink-main`, etc.)
- Accent color: `#f0c050` (gold) — consistent across all pages
- Min interactive text: 12px
- Min touch target: 44px (48px for primary actions)
- Always include `focus-visible` styles on new interactive elements
- Respect `prefers-reduced-motion: reduce`

### Protected Files

Do not modify structure of these without explicit user instruction:
- `data/all_nodes.json` schema
- `frontend/*.html` entry points
- `backend/routers/*.py` API signatures
- `backend/auth.py`
