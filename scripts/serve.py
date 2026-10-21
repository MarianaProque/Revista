"""Dependency-free local server with precompressed SVG support."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse
import gzip

ROOT = Path(__file__).resolve().parents[1]

class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        path = Path(self.translate_path(self.path))
        # Only original local SVG files are served from their gzip companions.
        if path.suffix == '.svg' and 'gzip' in self.headers.get('Accept-Encoding',''):
            compressed = path.with_suffix('.svg.gz')
            if compressed.is_file() and path.is_file():
                payload = compressed.read_bytes()
                self.send_response(200)
                self.send_header('Content-Type','image/svg+xml')
                self.send_header('Content-Encoding','gzip')
                self.send_header('Content-Length',str(len(payload)))
                self.send_header('Vary','Accept-Encoding')
                self.end_headers()
                self.wfile.write(payload)
                return
        super().do_GET()

    def end_headers(self):
        self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('Referrer-Policy','same-origin')
        super().end_headers()

if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--port',type=int,default=8000)
    args=parser.parse_args()
    print(f'Revista: http://127.0.0.1:{args.port}',flush=True)
    ThreadingHTTPServer(('127.0.0.1',args.port),partial(Handler,directory=str(ROOT))).serve_forever()
