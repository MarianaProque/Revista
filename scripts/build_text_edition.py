"""Accessible continuous reading from the same native portrait content."""
from pathlib import Path
from html import escape
import json
root=Path(__file__).resolve().parents[1]
edition=json.loads((root/'assets/portrait/edition.json').read_text(encoding='utf-8'))
parts=['''<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self'; img-src 'self'; object-src 'none'; base-uri 'self'"><title>Leitura em texto — O peso invisível da nuvem</title><link rel="stylesheet" href="style.css"></head><body><main class="text-reader"><a href="index.html">Voltar à revista</a><h1>O peso invisível da nuvem</h1><nav aria-label="Matérias"><ul>''']
for chapter in edition['chapters']:
    parts.append(f'<li><a href="#{chapter["id"]}">{escape(chapter["title"])}</a></li>')
parts.append('</ul></nav>')
for chapter in edition['chapters']:
    parts.append(f'<section id="{chapter["id"]}"><h2>{escape(chapter["title"])}</h2>')
    for block in chapter['blocks']:
        kind=block['type']
        if kind=='figure':
            parts.append(f'<figure><img src="{escape(block["src"])}" alt="{escape(block["alt"])}" width="{block["width"]}" height="{block["height"]}" loading="lazy"><figcaption>{escape(block.get("caption",""))}</figcaption></figure>')
        elif kind=='team':
            parts.append('<ul>'+''.join(f'<li>{escape(person["name"])}</li>' for person in block['people'])+'</ul>')
        elif kind=='callout':
            parts.append(f'<aside><h3>{escape(block["title"])}</h3><p>{escape(block["text"])}</p></aside>')
        elif kind=='subheading':
            parts.append(f'<h3>{escape(block["text"])}</h3>')
        else:
            parts.append(f'<p>{escape(block["text"])}</p>')
    parts.append(f'<p><a href="index.html#materia-{chapter["id"]}">Abrir esta matéria na revista</a></p></section>')
parts.append('</main></body></html>')
(root/'texto.html').write_text('\n'.join(parts),encoding='utf-8')
print('Continuous HTML edition built.')
