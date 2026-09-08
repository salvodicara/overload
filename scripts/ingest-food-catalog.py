#!/usr/bin/env python3
"""Reproduce the shipped catalog from USDA's unmodified SR Legacy CSV archive.
Usage: python3 scripts/ingest-food-catalog.py /physical/path/to/archive.zip
Downloads/provenance: docs/food-catalog-sources.md. Never infers missing nutrients.
"""
import csv
import hashlib
import io
import json
import math
from pathlib import Path
import sys
import zipfile

archive = Path(sys.argv[1]).resolve()
root = Path(__file__).resolve().parents[1]
mapping = {
    '1008': 'kcal', '1003': 'proteinG', '1005': 'carbsG', '1004': 'fatG',
    '1258': 'saturatedFatG', '1079': 'fiberG', '2000': 'sugarG',
    '1087': 'calciumMg', '1089': 'ironMg', '1090': 'magnesiumMg', '1092': 'potassiumMg',
    '1095': 'zincMg', '1093': 'sodiumMg', '1106': 'vitaminAMcg', '1162': 'vitaminCMg',
    '1114': 'vitaminDMcg', '1109': 'vitaminEMg', '1185': 'vitaminKMcg',
    '1165': 'vitaminB1Mg', '1166': 'vitaminB2Mg', '1167': 'vitaminB3Mg',
    '1175': 'vitaminB6Mg', '1178': 'vitaminB12Mcg', '1177': 'folateMcg',
}
translations = {
    '173944': 'Banana, cruda', '171688': 'Mela con buccia, cruda',
    '168878': 'Riso bianco a chicco lungo, arricchito, cotto',
    '171477': 'Petto di pollo, sola carne, arrosto', '171287': 'Uovo intero, crudo, fresco',
    '169705': 'Avena', '171413': 'Olio di oliva',
    '172217': 'Latte intero, 3,25% grassi, senza vitamine A e D aggiunte',
    '170894': 'Yogurt greco bianco, senza grassi', '170903': 'Yogurt greco bianco, magro',
    '171304': 'Yogurt greco bianco, latte intero', '170848': 'Formaggio tipo parmigiano, duro',
    '171247': 'Formaggio tipo parmigiano, grattugiato',
    '168928': 'Pasta cotta, non arricchita, senza sale aggiunto',
    '170440': 'Patate bollite senza buccia, senza sale',
    '172688': 'Pane integrale, produzione commerciale',
    '175168': 'Salmone atlantico di allevamento, cotto a calore secco',
    '173686': 'Salmone atlantico selvaggio, crudo',
    '172421': 'Lenticchie secche, bollite, senza sale',
    '170457': 'Pomodori rossi maturi, crudi', '170379': 'Broccoli, crudi',
}

with zipfile.ZipFile(archive) as source:
    def rows(name):
        path = next(n for n in source.namelist() if n.endswith('/' + name))
        return csv.DictReader(io.TextIOWrapper(source.open(path), encoding='utf-8-sig'))

    foods = {row['fdc_id']: {
        'id': 'usda:' + row['fdc_id'], 'name': row['description'], 'basis': 'g',
        'nutrients': {}, 'source': 'usda', 'sourceId': row['fdc_id'],
        **({'nameIt': translations[row['fdc_id']]} if row['fdc_id'] in translations else {}),
    } for row in rows('food.csv')}
    for row in rows('food_nutrient.csv'):
        key = mapping.get(row['nutrient_id'])
        if key is None or row['fdc_id'] not in foods or not row['amount']:
            continue
        amount = float(row['amount'])
        if math.isfinite(amount) and amount >= 0:
            foods[row['fdc_id']]['nutrients'][key] = amount
    result = sorted((food for food in foods.values() if food['nutrients']), key=lambda f: f['name'])
destination = root / 'public/data/foods-usda.json'
destination.parent.mkdir(parents=True, exist_ok=True)
destination.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n')
print(f'{len(result)} foods; {destination.stat().st_size} bytes; source SHA256 {hashlib.sha256(archive.read_bytes()).hexdigest()}')
