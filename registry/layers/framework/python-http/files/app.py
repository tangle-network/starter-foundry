import json
import os
from http.server import BaseHTTPRequestHandler, HTTPServer

PORT = int(os.environ.get("PORT", "{{port}}"))

try:
    with open("database-config.json", "r", encoding="utf-8") as handle:
        DATABASE = json.load(handle)
except FileNotFoundError:
    DATABASE = {"provider": "{{databaseProvider}}"}


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health":
            self.respond({
                "status": "ok",
                "service": "{{serviceName}}",
                "database": DATABASE.get("provider", "{{databaseProvider}}"),
            })
            return

        self.respond({
            "service": "{{serviceName}}",
            "database": DATABASE.get("provider", "{{databaseProvider}}"),
            "guidance": "Replace this Python stub with real application logic.",
        })

    def log_message(self, format, *args):
        return

    def respond(self, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    server = HTTPServer(("127.0.0.1", PORT), Handler)
    server.serve_forever()
