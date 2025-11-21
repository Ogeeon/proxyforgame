import json
from pathlib import Path
import csv

locale_dir = Path(r"d:\Programming\JS\pfg.wmp\www\locale")
files = sorted(locale_dir.glob('*.json'))

# load all locales
locales = {p.stem: json.loads(p.read_text(encoding='utf-8')) for p in files}

def flatten(d, prefix=''):
    items={}
    for k,v in d.items():
        key = prefix + k if prefix=='' else prefix + '.' + k
        if isinstance(v, dict):
            items.update(flatten(v, key))
        else:
            items[key]=v
    return items

flat_locales = {name: flatten(data) for name,data in locales.items()}

ru_keys = set(flat_locales.get('ru', {}).keys())
en = flat_locales.get('en', {})

# For each key present in ru, check which locales are missing the key or have empty value
rows = []
for k in sorted(ru_keys):
    ru_val = flat_locales['ru'].get(k, '')
    missing_locales = []
    for lname, flat in flat_locales.items():
        if lname == 'ru':
            continue
        if k not in flat or (isinstance(flat.get(k,''), str) and flat.get(k,'').strip()==''):
            missing_locales.append(lname)
    if missing_locales:
        en_val = en.get(k, '')
        rows.append({'key': k, 'ru': ru_val, 'en': en_val, 'missing_locales': ','.join(missing_locales)})

out_path = locale_dir / 'missing_translations.csv'
with out_path.open('w', encoding='utf-8', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=['key','ru','en','missing_locales'])
    writer.writeheader()
    for r in rows:
        writer.writerow(r)

print(f'Wrote {len(rows)} rows to {out_path}')
