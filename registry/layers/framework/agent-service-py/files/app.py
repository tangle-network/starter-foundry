import json
from http.server import BaseHTTPRequestHandler, HTTPServer

PORT = int(__import__("os").environ.get("PORT", "{{port}}"))


def load_config():
    try:
        with open("agent.config.json", "r", encoding="utf-8") as handle:
            return json.load(handle)
    except FileNotFoundError:
        return {
            "library": "{{agentLibrary}}",
            "surface": "{{agentSurface}}",
            "loop": ["plan", "act", "reflect"],
        }


CONFIG = load_config()


class AgentHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        body = json.dumps(
            {
                "status": "agent",
                "service": "{{serviceName}}",
                "library": CONFIG["library"],
                "surface": CONFIG["surface"],
                "loop": CONFIG["loop"],
            }
        ).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, _format, *_args):
        return


HTTPServer(("0.0.0.0", PORT), AgentHandler).serve_forever()
