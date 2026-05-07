#!/usr/bin/env python3

from __future__ import annotations

import argparse
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent
SPA_ENTRYPOINTS = {
    "/",
    "/index.html",
    "/404.html",
    "/app.js",
    "/feed.xml",
    "/build-info.json",
    "/CNAME",
}


class PreviewHandler(SimpleHTTPRequestHandler):
    def _should_serve_spa_shell(self) -> bool:
        request_path = self.path.split("?", 1)[0].split("#", 1)[0]
        if request_path in SPA_ENTRYPOINTS or request_path.startswith("/assets/"):
          return False

        candidate = Path(self.translate_path(request_path))
        return not candidate.exists()

    def do_GET(self) -> None:
        if self._should_serve_spa_shell():
            self.path = "/index.html"
        super().do_GET()

    def do_HEAD(self) -> None:
        if self._should_serve_spa_shell():
            self.path = "/index.html"
        super().do_HEAD()

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main() -> None:
    parser = argparse.ArgumentParser(description="Serve the portfolio site with SPA route fallback.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=4174)
    args = parser.parse_args()

    os.chdir(REPO_ROOT)
    server = ThreadingHTTPServer((args.host, args.port), PreviewHandler)
    print(f"Serving {REPO_ROOT} at http://{args.host}:{args.port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
