from pathlib import Path
import gzip
root=Path(__file__).resolve().parents[1]
total=compressed=0
for path in (root/'assets').glob('page-*.svg'):
    data=path.read_bytes()
    payload=gzip.compress(data,compresslevel=9,mtime=0)
    path.with_suffix('.svg.gz').write_bytes(payload)
    total+=len(data)
    compressed+=len(payload)
print(f'SVG: {total:,} bytes; gzip: {compressed:,} bytes ({compressed/total:.1%}).')
