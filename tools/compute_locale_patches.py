import json,os
from pathlib import Path

locale_dir = Path(r"d:\Programming\JS\pfg.wmp\www\locale")
files = [p for p in locale_dir.glob('*.json')]

def load(p):
    return json.loads(p.read_text(encoding='utf-8'))

def flatten(d, prefix=''):
    items={}
    for k,v in d.items():
        key = prefix + k if prefix=='' else prefix + '.' + k
        if isinstance(v, dict):
            items.update(flatten(v, key))
        else:
            items[key]=v
    return items

def unflatten(dotted):
    res = {}
    for k,v in dotted.items():
        parts=k.split('.')
        cur=res
        for p in parts[:-1]:
            cur = cur.setdefault(p, {})
        cur[parts[-1]] = v
    return res

all_data = {p.stem: load(p) for p in files}
if 'ru' not in all_data:
    print('ERROR: ru.json not found', flush=True)
    raise SystemExit(1)

keys_ru = flatten(all_data['ru'])
keys_en = flatten(all_data.get('en', {}))

# Precompute ru value -> list of keys
ru_val_to_keys = {}
for k,v in keys_ru.items():
    ru_val_to_keys.setdefault(v, []).append(k)

proposed = {}
for locale_name, data in all_data.items():
    if locale_name == 'ru':
        continue
    flat = flatten(data)
    missing = [k for k in keys_ru.keys() if k not in flat]
    additions = {}
    for k in missing:
        ru_val = keys_ru[k]
        chosen = None
        # reuse: find any other key in ru with same value that exists in target locale
        for candidate in ru_val_to_keys.get(ru_val, []):
            if candidate in flat:
                chosen = flat[candidate]
                break
        # fallback to en
        if chosen is None:
            chosen = keys_en.get(k)
        if chosen is None:
            chosen = ""
        additions[k]=chosen
    proposed[locale_name] = {'missing_count': len(missing), 'additions': unflatten(additions)}

print(json.dumps(proposed, ensure_ascii=False, indent=2))
