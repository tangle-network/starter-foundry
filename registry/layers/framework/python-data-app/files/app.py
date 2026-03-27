import json
import os
from http.server import BaseHTTPRequestHandler, HTTPServer

PORT = int(os.environ.get("PORT", "{{port}}"))

HTML = """<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{{headline}}</title>
    <style>
      body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; padding: 24px; background: #f8fafc; color: #0f172a; }
      .card { background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 16px; margin-top: 12px; }
    </style>
  </head>
  <body>
    <h1>{{headline}}</h1>
    <p>{{subheadline}}</p>
    <div class="card">
      <strong>Upload seam</strong>
      <p>Attach CSV, parquet, or model inference inputs here.</p>
    </div>
    <div class="card">
      <strong>Visualization seam</strong>
      <p>Render charts, KPI tiles, or notebook-style outputs here.</p>
    </div>
  </body>
</html>
"""


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health":
            payload = {"status": "ok", "service": "{{serviceName}}"}
            body = json.dumps(payload).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        body = HTML.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
