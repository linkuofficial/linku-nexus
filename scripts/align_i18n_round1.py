import json
from pathlib import Path

root = Path(__file__).resolve().parent.parent
i18n = root / 'data' / 'i18n'

zh = json.loads((i18n / 'zh.json').read_text(encoding='utf-8'))
ja = json.loads((i18n / 'ja.json').read_text(encoding='utf-8'))
nodes = json.loads((root / 'data' / 'all_nodes.json').read_text(encoding='utf-8')).get('nodes', [])

en_seed = {
    n.get('id'): n.get('label', '')
    for n in nodes
    if isinstance(n, dict) and isinstance(n.get('id'), str)
}

en = {
    k: str(en_seed.get(k, k.replace('_', ' ')))
    for k in zh.keys()
}

ja_aligned = {
    k: str(ja.get(k, en.get(k, '')))
    for k in zh.keys()
}

(i18n / 'en.json').write_text(json.dumps(en, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
(i18n / 'ja.json').write_text(json.dumps(ja_aligned, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

missing = [k for k in zh.keys() if k not in ja]
extra = [k for k in ja.keys() if k not in zh]

report = root / 'docs' / 'i18n_alignment_report_2026-05-24.md'
report.write_text(
    '\n'.join([
        '# i18n Alignment Report (2026-05-24)',
        '',
        f'- zh keys: {len(zh)}',
        f'- en keys: {len(en)}',
        f'- ja keys: {len(ja_aligned)}',
        f'- ja missing before alignment: {len(missing)}',
        f'- ja extra before alignment: {len(extra)}',
        '',
        '## Notes',
        '- en.json generated from node labels by id with key-name fallback.',
        '- ja.json preserved existing Japanese values; missing keys were filled with English labels for now.',
        '- ja extra keys (not in zh baseline) were dropped in aligned output.',
    ]),
    encoding='utf-8',
)

print('aligned', len(zh), 'keys; ja_missing_before', len(missing), 'ja_extra_before', len(extra))
