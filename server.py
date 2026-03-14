#!/usr/bin/env python3
"""
LinkStash - Local server
Run: python server.py
Then open: http://localhost:5000
Links are saved to links.json in the same folder.
"""

import json
import os
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse

PORT = 8765
DATA_FILE = os.path.join(os.path.dirname(__file__), "links.json")


def load_links():
    if not os.path.exists(DATA_FILE):
        return []
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_links(links):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(links, f, indent=2, ensure_ascii=False)


class Handler(BaseHTTPRequestHandler):

    def log_message(self, format, *args):
        print(f"  {args[0]} {args[1]}")

    def send_json(self, data, status=200):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", len(body))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def send_file(self, path, content_type):
        with open(path, "rb") as f:
            body = f.read()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", len(body))
        self.end_headers()
        self.wfile.write(body)

    def read_body(self):
        length = int(self.headers.get("Content-Length", 0))
        return json.loads(self.rfile.read(length)) if length else {}

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        path = urlparse(self.path).path

        if path == "/api/links":
            self.send_json(load_links())
            return

        # Static file serving
        STATIC = {
            "/":           ("index.html", "text/html; charset=utf-8"),
            "/index.html": ("index.html", "text/html; charset=utf-8"),
            "/styles.css": ("styles.css", "text/css; charset=utf-8"),
            "/app.js":     ("app.js",     "application/javascript; charset=utf-8"),
        }

        if path in STATIC:
            filename, content_type = STATIC[path]
            filepath = os.path.join(os.path.dirname(__file__), filename)
            if os.path.exists(filepath):
                self.send_file(filepath, content_type)
            else:
                self.send_response(404)
                self.end_headers()
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path == "/api/links":
            link = self.read_body()
            links = load_links()
            links.insert(0, link)
            save_links(links)
            self.send_json(link, 201)
        else:
            self.send_response(404)
            self.end_headers()

    def do_PUT(self):
        # /api/links/<id>
        parts = self.path.strip("/").split("/")
        if len(parts) == 3 and parts[0] == "api" and parts[1] == "links":
            link_id = int(parts[2])
            updated = self.read_body()
            links = load_links()
            for i, l in enumerate(links):
                if l["id"] == link_id:
                    links[i] = updated
                    break
            save_links(links)
            self.send_json(updated)
        else:
            self.send_response(404)
            self.end_headers()

    def do_DELETE(self):
        parts = self.path.strip("/").split("/")
        if len(parts) == 3 and parts[0] == "api" and parts[1] == "links":
            link_id = int(parts[2])
            links = [l for l in load_links() if l["id"] != link_id]
            save_links(links)
            self.send_json({"deleted": link_id})
        else:
            self.send_response(404)
            self.end_headers()


if __name__ == "__main__":
    server = HTTPServer(("localhost", PORT), Handler)
    print(f"\n  LinkStash running at http://localhost:{PORT}")
    print(f"  Links saved to: {DATA_FILE}")
    print(f"  Press Ctrl+C to stop.\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Stopped.")
