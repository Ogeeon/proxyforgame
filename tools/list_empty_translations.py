import json
from pathlib import Path

locale_dir = Path(r"d:\Programming\JS\pfg.wmp\www\locale")
files = sorted(locale_dir.glob('*.json'))

def flatten(d, prefix=''):
    items={}
    for k,v in d.items():
        key = prefix + k if prefix=='' else prefix + '.' + k
        if isinstance(v, dict):
            items.update(flatten(v, key))
        else:
            items[key]=v
    return items

summary = {}
for p in files:
    name = p.stem
    data = json.loads(p.read_text(encoding='utf-8'))
    flat = flatten(data)
    empties = [k for k,v in flat.items() if isinstance(v, str) and v.strip()==""]
    summary[name] = empties

for name, empties in summary.items():
    print(f"{name}: {len(empties)} empty translations")
    for k in empties[:200]:
        print('  -', k)
    if len(empties)>200:
        print('  ...')
    print()
