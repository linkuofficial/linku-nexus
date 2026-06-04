import json
from pathlib import Path

root = Path('d:/Code_Space/Nodus')
i18n = root / 'data' / 'i18n'

zh = json.loads((i18n / 'zh.json').read_text(encoding='utf-8'))
en = json.loads((i18n / 'en.json').read_text(encoding='utf-8'))
ja = json.loads((i18n / 'ja.json').read_text(encoding='utf-8'))

# Traditional Chinese -> common Japanese shinjitai/usage approximations.
MAP = {
    '學': '学', '術': '術', '體': '体', '變': '変', '廣': '広', '圖': '図', '譜': '譜',
    '與': 'と', '為': '為', '關': '関', '聯': '連', '證': '証', '實': '実', '醫': '医',
    '藥': '薬', '氣': '気', '數': '数', '電': '電', '網': '網', '經': '経', '濟': '済',
    '歷': '歴', '國': '国', '論': '論', '識': '識', '覺': '覚', '類': '類', '邏': '論',
    '輯': '理', '廣': '広', '應': '応', '領': '領', '導': '導', '邊': '辺', '復': '復',
    '製': '製', '裝': '装', '對': '対', '價': '価', '雜': '雑', '雙': '双', '擬': '擬',
    '專': '専', '語': '語', '譯': '訳', '釋': '釈', '詮': '解', '觀': '観', '將': '将',
    '壓': '圧', '縮': '縮', '聲': '声', '驗': '験', '環': '環', '舊': '旧', '戰': '戦',
    '產': '産', '業': '業', '認': '認', '讓': '譲', '組': '組', '織': '織', '優': '優',
    '勢': '勢', '態': '態', '極': '極', '點': '点', '區': '区', '務': '務', '書': '書',
    '範': '範', '疇': '疇', '標': '標', '準': '準', '視': '視', '覺': '覚', '覺': '覚',
    '臺': '台', '灣': '湾', '（': '（', '）': '）', '，': '、', '：': '：'
}


def zh_to_ja(text: str) -> str:
    out = ''.join(MAP.get(ch, ch) for ch in text)
    # Phrase-level cleanups for common academic wording.
    out = out.replace('計算機科学', 'コンピュータサイエンス')
    out = out.replace('社会科学', '社会科学')
    out = out.replace('微積分基本定理', '微積分学の基本定理')
    out = out.replace('病菌致病論', '病原菌説')
    out = out.replace('知識論', '認識論')
    out = out.replace('心霊哲学', '心の哲学')
    out = out.replace('史学方法論', '史学方法論')
    out = out.replace('賽局理論', 'ゲーム理論')
    out = out.replace('訊号', '信号')
    out = out.replace('模式識別', 'パターン認識')
    out = out.replace('跨学科研究', '学際研究')
    out = out.replace('機器人学', 'ロボット工学')
    out = out.replace('資料科学', 'データサイエンス')
    out = out.replace('人工智慧', '人工知能')
    out = out.replace('語言哲学', '言語哲学')
    out = out.replace('數学哲学', '数学哲学')
    return out

updated = 0
for k in zh.keys():
    cur = str(ja.get(k, '')).strip()
    en_v = str(en.get(k, '')).strip()
    if not cur or (en_v and cur == en_v):
        ja[k] = zh_to_ja(str(zh.get(k, en_v)))
        updated += 1

(i18n / 'ja.json').write_text(json.dumps(ja, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

same = [k for k, v in ja.items() if en.get(k) == v and isinstance(v, str) and v.strip()]
print('updated', updated)
print('ja_still_equal_to_en', len(same))
print('sample_remaining', same[:20])
