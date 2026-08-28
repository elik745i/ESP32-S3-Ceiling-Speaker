#!/usr/bin/env python3
"""Serve the device UI from localhost and proxy its API for Web Serial.

Chrome and Edge treat http://localhost as a trustworthy context, while an ESP
device's ordinary http://192.168.x.x page is not allowed to use Web Serial.
This helper binds only to loopback and forwards API traffic to one chosen ESP.
"""

from __future__ import annotations

import argparse
import http.client
import pathlib
import threading
import urllib.parse
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


HOP_BY_HOP_HEADERS = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
}


class DeviceUiProxy(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    device_host = ""
    device_port = 80

    def _proxy(self) -> None:
        content_length = int(self.headers.get("Content-Length", "0") or "0")
        body = self.rfile.read(content_length) if content_length else None
        headers = {
            name: value
            for name, value in self.headers.items()
            if name.lower() not in HOP_BY_HOP_HEADERS and name.lower() != "host"
        }

        connection = http.client.HTTPConnection(self.device_host, self.device_port, timeout=180)
        try:
            connection.request(self.command, self.path, body=body, headers=headers)
            response = connection.getresponse()
            self.send_response(response.status, response.reason)
            for name, value in response.getheaders():
                if name.lower() not in HOP_BY_HOP_HEADERS:
                    self.send_header(name, value)
            self.send_header("Connection", "close")
            self.end_headers()
            while True:
                chunk = response.read(64 * 1024)
                if not chunk:
                    break
                self.wfile.write(chunk)
        except (OSError, http.client.HTTPException) as error:
            self.send_error(502, f"Device proxy error: {error}")
        finally:
            connection.close()
            self.close_connection = True

    def _dispatch(self) -> None:
        if self.path.startswith("/api/") or self.path.startswith("/wifi-handoff.svg"):
            self._proxy()
        elif self.command == "GET" or self.command == "HEAD":
            super_method = super().do_GET if self.command == "GET" else super().do_HEAD
            super_method()
        else:
            self.send_error(405, "Only device API routes accept this method")

    def do_GET(self) -> None:
        self._dispatch()

    def do_HEAD(self) -> None:
        self._dispatch()

    def do_POST(self) -> None:
        self._dispatch()

    def do_PUT(self) -> None:
        self._dispatch()

    def do_DELETE(self) -> None:
        self._dispatch()


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Open an ELMA IoT device UI on localhost so Chrome/Edge Web Serial is available."
    )
    parser.add_argument("device", help="Device IP or HTTP URL, for example 192.168.1.41")
    parser.add_argument("--port", type=int, default=8765, help="Local loopback port (default: 8765)")
    parser.add_argument("--no-browser", action="store_true", help="Do not open the browser automatically")
    return parser.parse_args()


def main() -> None:
    arguments = parse_arguments()
    device_url = arguments.device if "://" in arguments.device else f"http://{arguments.device}"
    parsed = urllib.parse.urlparse(device_url)
    if parsed.scheme != "http" or not parsed.hostname or parsed.path not in ("", "/"):
        raise SystemExit("Device must be an HTTP IP/hostname without a path, for example 192.168.1.41")
    if arguments.port < 1024 or arguments.port > 65535:
        raise SystemExit("Local port must be between 1024 and 65535")

    web_root = pathlib.Path(__file__).resolve().parents[1] / "web"
    handler = lambda *handler_args, **handler_kwargs: DeviceUiProxy(
        *handler_args, directory=str(web_root), **handler_kwargs
    )
    DeviceUiProxy.device_host = parsed.hostname
    DeviceUiProxy.device_port = parsed.port or 80

    local_url = f"http://localhost:{arguments.port}/"
    server = ThreadingHTTPServer(("127.0.0.1", arguments.port), handler)
    print(f"ELMA IoT USB flasher proxy: {local_url}")
    print(f"Forwarding device API requests to http://{DeviceUiProxy.device_host}:{DeviceUiProxy.device_port}")
    print("Press Ctrl+C to stop.")
    if not arguments.no_browser:
        threading.Timer(0.4, lambda: webbrowser.open(local_url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
