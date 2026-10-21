"""Repair SVG soft-mask type after promoting reused image definitions."""
from pathlib import Path
import xml.etree.ElementTree as ET
SVG='http://www.w3.org/2000/svg'
XLINK='http://www.w3.org/1999/xlink'
ET.register_namespace('',SVG)
ET.register_namespace('xlink',XLINK)
for path in (Path(__file__).resolve().parents[1]/'assets').glob('page-*.svg'):
    tree=ET.parse(path)
    root=tree.getroot()
    images={node.get('id') for node in root.iter(f'{{{SVG}}}image') if node.get('id')}
    for mask in root.iter(f'{{{SVG}}}mask'):
        if any(node.get(f'{{{XLINK}}}href','').lstrip('#') in images for node in mask.iter()):
            mask.attrib.pop('mask-type',None)
    tree.write(path,encoding='utf-8',xml_declaration=True)
print('Mask references verified.')
