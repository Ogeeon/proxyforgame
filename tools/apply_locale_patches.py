import json
from pathlib import Path
import shutil

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
    raise SystemExit('ru.json not found')

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
    proposed[locale_name] = unflatten(additions)

# Apply patches: backup originals then write merged
changed = []
for locale_name, additions in proposed.items():
    target_path = locale_dir / (locale_name + '.json')
    if not target_path.exists():
        print(f"Skipping {locale_name}: file not found")
        continue
    orig = load(target_path)
    # deep merge additions into orig
    def merge(a, b):
        for k,v in b.items():
            if isinstance(v, dict) and k in a and isinstance(a[k], dict):
                merge(a[k], v)
            else:
                a[k] = v
    merged = orig.copy()
    merge(merged, additions)
    # backup
    bak = target_path.with_suffix('.json.bak')
    shutil.copyfile(target_path, bak)
    # write back
    target_path.write_text(json.dumps(merged, ensure_ascii=False, indent=2), encoding='utf-8')
    changed.append(str(target_path))

# Validate all JSON files parse
errors = {}
for p in files:
    try:
        json.loads(p.read_text(encoding='utf-8'))
    except Exception as e:
        errors[str(p)] = str(e)

print('changed_files:')
for c in changed:
    print(' -', c)
print('errors:')
if not errors:
    print('none')
else:
    for k,v in errors.items():
        print(k, v)
