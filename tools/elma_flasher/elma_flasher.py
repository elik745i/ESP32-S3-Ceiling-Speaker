"""ELMA Flasher: standalone ELMA device designer, compiler and flash utility."""

from __future__ import annotations

import base64
import binascii
import contextlib
import ctypes
import io
import ipaddress
import json
import os
import pathlib
import queue
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import tkinter as tk
import urllib.error
import urllib.parse
import urllib.request
import uuid
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from tkinter import filedialog, messagebox, ttk

import esptool
import serial
from serial.tools import list_ports


APP_VERSION = "0.1.33"
WINDOWS_APP_USER_MODEL_ID = "ELMA.IoT.Flasher"
FLASH_BAUD = 460800
CONSOLE_BAUD = 115200
OTA_DATA_ADDRESS = 0xE000
OTA_DATA_SIZE = 0x2000
APPLICATION_ADDRESS = 0x10000
MAX_APPLICATION_SIZE = 0x1F0000
PROVISION_TIMEOUT_SECONDS = 120
ORANGE = "#ef8b00"
DARK = "#2a2926"
PAPER = "#f7f5ef"
WHITE = "#fffdf8"
MUTED = "#6e6961"
RED = "#b42318"
GREEN = "#18864b"
CHIP_FAMILIES = {"esp32": "ESP32", "esp32s3": "ESP32-S3", "esp32c3": "ESP32-C3"}
CHIP_CHOICES = {"auto": "Auto-detect (recommended)", **CHIP_FAMILIES}
KNOWN_CHIP_MODELS = {
    "esp32s3": "ESP32-S3",
    "esp32c3": "ESP32-C3",
    "esp32c6": "ESP32-C6",
    "esp32s2": "ESP32-S2",
    "esp32h2": "ESP32-H2",
    "esp32c2": "ESP32-C2",
    "esp32c5": "ESP32-C5",
    "esp32p4": "ESP32-P4",
    "esp32": "ESP32",
}


def resource_path(relative: str) -> pathlib.Path:
    base = pathlib.Path(getattr(sys, "_MEIPASS", pathlib.Path(__file__).resolve().parent))
    resolved = base / relative
    if not getattr(sys, "frozen", False) and relative.replace("\\", "/").startswith("assets/"):
        development_asset = pathlib.Path(__file__).resolve().parents[2] / ".elma-flasher-build" / relative
        if development_asset.exists():
            return development_asset
    return resolved


def configure_windows_identity() -> None:
    """Give the process its own Windows taskbar identity before creating a window."""
    if sys.platform == "win32":
        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(WINDOWS_APP_USER_MODEL_ID)


def window_has_windows_icon(root: tk.Tk) -> bool:
    """Confirm that the native top-level window exposes a taskbar icon handle."""
    if sys.platform != "win32":
        return True
    user32 = ctypes.windll.user32
    window = int(root.winfo_id())
    handles = []
    while window and window not in handles:
        handles.append(window)
        window = int(user32.GetParent(window))
    wm_geticon = 0x007F
    for handle in handles:
        for icon_type in (1, 0, 2):  # ICON_BIG, ICON_SMALL, ICON_SMALL2
            if user32.SendMessageW(handle, wm_geticon, icon_type, 0):
                return True
        if user32.GetClassLongPtrW(handle, -14) or user32.GetClassLongPtrW(handle, -34):
            return True
    return False


def chip_family_from_image(data: bytes) -> str:
    if len(data) < 24 or data[0] != 0xE9:
        raise ValueError("The selected file is not a valid ESP32 application image.")
    chip_id = data[12] | (data[13] << 8)
    if chip_id == 0x0000:
        return "esp32"
    if chip_id == 0x0009:
        return "esp32s3"
    if chip_id == 0x0005:
        return "esp32c3"
    raise ValueError(f"Unsupported Espressif image chip ID 0x{chip_id:04X}.")


def chip_family_from_esptool_output(output: str) -> str:
    normalized = output.upper().replace("_", "-")
    for model, label in KNOWN_CHIP_MODELS.items():
        if re.search(rf"\b{re.escape(label)}\b", normalized):
            return model
    raise RuntimeError("The flashing engine connected, but did not report a recognized ESP chip model.")


def flash_size_from_esptool_output(output: str) -> str:
    match = re.search(r"(?:Embedded\s+)?Flash\s+(\d+)\s*(MB|KB)\b", output, re.I)
    return f"{match.group(1)} {match.group(2).upper()}" if match else ""


def crc32(data: bytes) -> int:
    return binascii.crc32(data) & 0xFFFFFFFF


def sanitize_clone_configuration(settings: object) -> dict:
    if not isinstance(settings, dict):
        raise ValueError("Source device returned an invalid configuration object.")
    cloned = json.loads(json.dumps(settings))
    device = cloned.setdefault("device", {})
    mqtt = cloned.setdefault("mqtt", {})
    wifi = cloned.setdefault("wifi", {})
    if isinstance(device, dict):
        device.pop("deviceName", None)
        device.pop("friendlyName", None)
    if isinstance(mqtt, dict):
        mqtt.pop("clientId", None)
        mqtt.pop("baseTopic", None)
    if isinstance(wifi, dict):
        # A source device's static address must never be duplicated onto a new
        # device. It can be supplied explicitly in Preconfigure target instead.
        wifi["useStaticIp"] = False
        for field in ("staticIp", "gateway", "subnet", "dns1", "dns2"):
            wifi.pop(field, None)
    cloned.pop("usingSavedSettings", None)
    return cloned


def merge_configuration(base: dict, overrides: dict) -> dict:
    merged = json.loads(json.dumps(base))
    for section, values in overrides.items():
        if not isinstance(values, dict):
            merged[section] = values
            continue
        target = merged.setdefault(section, {})
        if not isinstance(target, dict):
            target = {}
            merged[section] = target
        target.update(values)
    # These identities are always derived by firmware from the target efuse MAC.
    device = merged.setdefault("device", {})
    mqtt = merged.setdefault("mqtt", {})
    if isinstance(device, dict):
        device.pop("deviceName", None)
    if isinstance(mqtt, dict):
        mqtt.pop("clientId", None)
        mqtt.pop("baseTopic", None)
    return merged


def friendly_error(error: BaseException) -> str:
    message = str(error).strip() or error.__class__.__name__
    lowered = message.lower()
    if "access is denied" in lowered or "permission" in lowered or "could not open port" in lowered:
        return "The COM port is busy or unavailable. Close serial monitors and other flashing tools, reconnect the device, and try again."
    if "failed to connect" in lowered or "connecting" in lowered or "bootloader" in lowered:
        return "Could not enter the ESP bootloader. Hold BOOT, tap RESET, release BOOT after connection starts, and retry."
    if "urlopen" in lowered or "timed out" in lowered or "host" in lowered:
        return "The source device could not be reached. Verify its IP address, Wi-Fi connection, and web credentials."
    if "401" in lowered or "unauthorized" in lowered:
        return "The source device rejected its web username or password."
    if "disconnected" in lowered or "device not configured" in lowered:
        return "The USB device disconnected. Check its data cable and power, reconnect it, and retry."
    return message


class HttpDeviceClient:
    def __init__(self, host: str, username: str = "", password: str = "") -> None:
        value = host.strip().rstrip("/")
        if not value:
            raise ValueError("Enter the source device IP address.")
        if "://" not in value:
            value = f"http://{value}"
        parsed = urllib.parse.urlparse(value)
        if parsed.scheme != "http" or not parsed.hostname or parsed.path not in ("", "/"):
            raise ValueError("Use an HTTP device IP or hostname without a path, for example 192.168.1.41.")
        self.base_url = value
        self.authorization = ""
        if username or password:
            token = base64.b64encode(f"{username}:{password}".encode()).decode()
            self.authorization = f"Basic {token}"

    def _request(self, path: str) -> bytes:
        headers = {"Accept": "application/json", "User-Agent": f"ELMA-Flasher/{APP_VERSION}"}
        if self.authorization:
            headers["Authorization"] = self.authorization
        request = urllib.request.Request(f"{self.base_url}{path}", headers=headers)
        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                return response.read()
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", "replace")
            raise RuntimeError(f"Source device HTTP {error.code}: {detail or error.reason}") from error

    def json(self, path: str) -> dict:
        try:
            value = json.loads(self._request(path).decode("utf-8"))
        except json.JSONDecodeError as error:
            raise RuntimeError(f"Source device returned invalid JSON for {path}.") from error
        if not isinstance(value, dict):
            raise RuntimeError(f"Source device returned an invalid object for {path}.")
        return value

    def binary(self, path: str, expected_size: int = 0) -> bytes:
        data = self._request(path)
        if expected_size and len(data) != expected_size:
            raise RuntimeError(f"Incomplete firmware part: received {len(data)} of {expected_size} bytes.")
        return data


class EsptoolOutput(io.TextIOBase):
    def __init__(self, callback) -> None:
        self.callback = callback
        self.buffer = ""

    def writable(self) -> bool:
        return True

    def write(self, value: str) -> int:
        self.buffer += str(value).replace("\r", "\n")
        lines = self.buffer.split("\n")
        self.buffer = lines.pop()
        for line in lines:
            if line.strip():
                self.callback(line.strip())
        return len(value)

    def flush(self) -> None:
        if self.buffer.strip():
            self.callback(self.buffer.strip())
        self.buffer = ""


def default_designer_settings() -> dict:
    """A complete-enough future-device document for the shared web configurator."""
    return {
        "usingSavedSettings": False,
        "device": {
            "deviceName": "elma-future-device", "friendlyName": "ELMA Future Device",
            "savedVolumePercent": 35, "audioMuted": False, "statusLedPin": 8,
            "lowBatterySleepEnabled": False, "lowBatterySleepThresholdPercent": 10,
            "lowBatteryWakeIntervalMinutes": 30, "powerCycleFactoryResetEnabled": True,
            "touchHoldFactoryResetEnabled": True,
        },
        "wifi": {
            "ssid": "", "password": "", "apSsid": "", "apPassword": "",
            "apFallbackEnabled": True, "useStaticIp": False, "staticIp": "",
            "gateway": "", "subnet": "255.255.255.0", "dns1": "", "dns2": "",
        },
        "mqtt": {
            "host": "", "port": 1883, "username": "", "password": "",
            "clientId": "", "baseTopic": "", "discoveryEnabled": True,
        },
        "audio": {"enabled": False, "rememberLastPlayed": True, "wsPin": 5, "bclkPin": 4, "doutPin": 3},
        "oled": {"enabled": False, "displayType": "oled", "driver": "ssd1306", "i2cAddress": 60, "width": 128, "height": 64, "rotation": 0, "dimTimeoutSeconds": 60, "sdaPin": 4, "sclPin": 5, "resetPin": -1},
        "sd": {"enabled": False, "csPin": 10, "sckPin": 6, "mosiPin": 7, "misoPin": 2},
        "battery": {"adcPin": 0, "calibrationMultiplier": 2.0, "measuredVoltage": 0, "movingAverageWindowSize": 8, "updateIntervalMs": 5000},
        "ota": {"autoCheck": True, "autoUpdate": False},
        "webAuth": {"enabled": False, "username": "admin", "password": ""},
        "effects": {},
        "ui": {
            "gpioBoardAutodetect": False, "gpioBoardSelection": "esp32-c3",
            "peripheralDiagramPositions": {}, "peripheralHelperBindings": {},
            "peripheralProfiles": {
                "audioProfile": "none", "audioProfiles": ["none"], "audioInProfile": "none",
                "audioInProfiles": ["none"], "displayProfile": "none", "displayProfiles": ["none"],
                "sensors": ["none"], "inputs": ["none"], "controls": ["none"],
                "expansions": ["none"], "storage": ["none"], "communication": ["none"], "power": ["none"],
            },
        },
    }


class DesignerJob:
    def __init__(self) -> None:
        self.id = uuid.uuid4().hex
        self.state = "queued"
        self.progress = 0
        self.status = "Queued"
        self.compatibility = "Resolving chip capabilities and selected peripherals."
        self.log: list[str] = []
        self.error = ""
        self.ip_address = ""
        self.cancelled = False
        self.process: subprocess.Popen | None = None

    def append(self, value: str) -> None:
        line = str(value).strip()
        if line:
            self.log.append(line)
            self.log = self.log[-600:]

    def public(self) -> dict:
        return {
            "jobId": self.id, "state": self.state, "progress": self.progress,
            "status": self.status, "compatibility": self.compatibility,
            "log": self.log, "error": self.error, "ipAddress": self.ip_address,
        }


class DesignerServer:
    """Loopback-only backend for the cloned web configurator and native flashing."""
    def __init__(self, flasher: "FlasherApplication") -> None:
        self.flasher = flasher
        self.httpd: ThreadingHTTPServer | None = None
        self.thread: threading.Thread | None = None
        self.url = ""
        self.settings = default_designer_settings()
        self.jobs: dict[str, DesignerJob] = {}
        self.lock = threading.Lock()

    def web_root(self) -> pathlib.Path:
        bundled = resource_path("web")
        if bundled.is_dir():
            return bundled
        return pathlib.Path(__file__).resolve().parents[2] / "web"

    def project_root(self) -> pathlib.Path:
        if not getattr(sys, "frozen", False):
            return pathlib.Path(__file__).resolve().parents[2]
        source = resource_path("builder_project")
        target = pathlib.Path(os.environ.get("LOCALAPPDATA", tempfile.gettempdir())) / "ELMA IoT" / "Flasher" / f"builder-{APP_VERSION}"
        marker = target / ".elma-builder-ready"
        if not marker.is_file():
            target.mkdir(parents=True, exist_ok=True)
            for name in ("src", "include", "scripts", "partitions", "web"):
                shutil.copytree(source / name, target / name, dirs_exist_ok=True)
            for name in ("platformio.ini", "sdkconfig.defaults", "package.json", "package-lock.json"):
                if (source / name).is_file():
                    shutil.copy2(source / name, target / name)
            marker.write_text(APP_VERSION, encoding="utf-8")
        return target

    def compiler_command(self) -> list[str]:
        bundled = resource_path("ELMA-Compiler-Core.exe")
        if bundled.is_file():
            return [str(bundled)]
        found = shutil.which("pio") or shutil.which("platformio")
        if found:
            return [found]
        raise RuntimeError("The portable compiler core is missing. Reinstall ELMA Flasher or use the complete release package.")

    def start(self) -> str:
        if self.httpd:
            return self.url
        owner = self

        class Handler(SimpleHTTPRequestHandler):
            def __init__(handler_self, *args, **kwargs):
                super().__init__(*args, directory=str(owner.web_root()), **kwargs)

            def log_message(handler_self, _format, *_args):
                return

            def json_response(handler_self, value, status=200):
                data = json.dumps(value, separators=(",", ":")).encode()
                handler_self.send_response(status)
                handler_self.send_header("Content-Type", "application/json")
                handler_self.send_header("Content-Length", str(len(data)))
                handler_self.send_header("Cache-Control", "no-store")
                handler_self.end_headers()
                handler_self.wfile.write(data)

            def read_json(handler_self):
                length = int(handler_self.headers.get("Content-Length", "0") or 0)
                if length > 2 * 1024 * 1024:
                    raise ValueError("Request is too large")
                return json.loads(handler_self.rfile.read(length) or b"{}")

            def do_GET(handler_self):
                path = urllib.parse.urlparse(handler_self.path).path
                if path == "/api/builder/status":
                    handler_self.json_response({"active": True, "version": APP_VERSION})
                elif path == "/api/builder/ports":
                    ports = [{"device": p.device, "description": p.description, "hwid": p.hwid} for p in list_ports.comports()]
                    handler_self.json_response({"ports": ports})
                elif path.startswith("/api/builder/jobs/"):
                    job_id = path.split("/")[4]
                    job = owner.jobs.get(job_id)
                    handler_self.json_response(job.public() if job else {"error": "Unknown builder job"}, 200 if job else 404)
                elif path == "/api/settings":
                    handler_self.json_response(owner.settings)
                elif path == "/api/status":
                    handler_self.json_response(owner.mock_status())
                elif path.startswith("/api/"):
                    handler_self.json_response({"error": "This runtime action is unavailable while designing a future device."}, 409)
                else:
                    super().do_GET()

            def do_POST(handler_self):
                path = urllib.parse.urlparse(handler_self.path).path
                try:
                    body = handler_self.read_json()
                    if path == "/api/settings":
                        if not isinstance(body, dict):
                            raise ValueError("Settings must be a JSON object")
                        owner.settings = body
                        handler_self.json_response({"ok": True})
                    elif path == "/api/builder/jobs":
                        job = owner.create_job(body)
                        handler_self.json_response({"jobId": job.id}, 202)
                    elif path.startswith("/api/builder/jobs/") and path.endswith("/cancel"):
                        job_id = path.split("/")[4]
                        job = owner.jobs.get(job_id)
                        if not job:
                            handler_self.json_response({"error": "Unknown builder job"}, 404)
                            return
                        job.cancelled = True
                        if job.process and job.process.poll() is None:
                            job.process.terminate()
                        handler_self.json_response({"ok": True})
                    else:
                        handler_self.json_response({"error": "Unsupported local builder action"}, 404)
                except (ValueError, json.JSONDecodeError) as error:
                    handler_self.json_response({"error": str(error)}, 400)

        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.url = f"http://127.0.0.1:{self.httpd.server_port}/"
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()
        return self.url

    def stop(self) -> None:
        server = self.httpd
        thread = self.thread
        self.httpd = None
        self.thread = None
        self.url = ""
        if server is not None:
            server.shutdown()
            server.server_close()
        if thread is not None and thread.is_alive():
            thread.join(timeout=2)

    def mock_status(self) -> dict:
        selected = str(self.settings.get("ui", {}).get("gpioBoardSelection", "esp32-c3"))
        chip = "esp32s3" if "s3" in selected else ("esp32c3" if "c3" in selected else "esp32")
        return {
            "firmware": {"version": APP_VERSION, "channel": "designer", "chipFamily": chip, "audioEnabled": True},
            "device": {"friendlyName": self.settings.get("device", {}).get("friendlyName", "Future ELMA Device"), "deviceName": "hardware-id-assigned-after-flash", "ipAddress": "Not flashed", "connected": False},
            "network": {"wifiConnected": False, "mqttConnected": False, "wifiRssi": 0, "ip": "", "apMode": False},
            "battery": {"voltage": 0, "raw": 0, "charging": False},
            "playback": {"state": "idle", "type": "idle", "title": "Not flashed", "url": "", "source": "designer", "volumePercent": 0},
            "otaManager": {"busy": False, "message": "Local device designer", "updateAvailable": False},
            "ota": {"busy": False, "message": "Local device designer", "updateAvailable": False, "latestVersion": ""},
            "settings": {"usingSaved": False},
            "hardware": {"chipModel": CHIP_FAMILIES.get(chip, chip), "flashSize": 0, "freeHeap": 0},
            "system": {"freeHeap": 0, "cpuLoadPercent": 0, "cpuFrequencyMhz": 0, "sram": {}, "psram": {}, "spiffs": {}, "sd": {}},
            "storage": {"flash": {"available": False}, "sd": {"available": False}},
            "display": {"enabled": False},
        }

    def create_job(self, payload: dict) -> DesignerJob:
        if not isinstance(payload, dict) or not str(payload.get("port", "")).strip():
            raise ValueError("Select a connected USB device")
        with self.lock:
            if any(job.state in ("queued", "running") for job in self.jobs.values()):
                raise ValueError("Another compile or flash job is already running")
            job = DesignerJob()
            self.jobs[job.id] = job
        threading.Thread(target=self.run_job, args=(job, payload), daemon=True).start()
        return job

    def set_job(self, job: DesignerJob, progress: int, status: str) -> None:
        job.progress = progress
        job.status = status
        job.append(status)

    def resolve_profile(self, detected: str, requested: dict, settings: dict, job: DesignerJob) -> str:
        maximum = bool(requested.get("maximum", True))
        audio_profiles = settings.get("ui", {}).get("peripheralProfiles", {}).get("audioProfiles", []) if isinstance(settings, dict) else []
        configured_audio = any(str(value).strip().lower() not in ("", "none") for value in audio_profiles if value is not None)
        wants_audio = bool(requested.get("audio", False) or configured_audio)
        wants_web = bool(requested.get("webUi", True))
        wants_hacs = bool(requested.get("hacs", True))
        if detected == "esp32c3":
            exclusions = ["I2S network audio (not selected for the C3 memory profile)"]
            if not wants_web:
                exclusions.append("on-device web configurator (explicitly disabled)")
            job.compatibility = "ESP32-C3 maximum-fit profile: Wi-Fi, MQTT/HACS, OTA, motor/GPIO, supported displays, sensors, controls and the compatible web configurator are retained. Excluded: " + "; ".join(exclusions) + "."
            if maximum:
                return "esp32c3_designer_hacs"
            return "esp32c3_designer" + ("_hacs" if wants_hacs else "") + ("_slim" if not wants_web else "")
        if detected == "esp32s3":
            if maximum:
                job.compatibility = "ESP32-S3 full profile selected: all currently supported peripherals and multimedia features are retained."
                return "esp32s3_notifier_hacs"
            job.compatibility = f"ESP32-S3 selected-feature profile: web UI {'included' if wants_web else 'excluded'}, HACS {'included' if wants_hacs else 'excluded'}, audio {'included' if wants_audio else 'excluded'}."
            if wants_audio:
                if wants_hacs:
                    return "esp32s3_notifier_hacs" if wants_web else "esp32s3_notifier_hacs_slim"
                return "esp32s3_notifier" if wants_web else "esp32s3_notifier_slim"
            return "esp32s3_designer_noaudio" + ("_hacs" if wants_hacs else "") + ("_slim" if not wants_web else "")
        if detected == "esp32":
            if maximum:
                job.compatibility = "ESP32 maximum compatible profile selected; the complete classic-ESP32 peripheral catalog is retained."
                return "esp32_notifier_hacs"
            job.compatibility = f"ESP32 selected-feature profile: web UI {'included' if wants_web else 'excluded'}, HACS {'included' if wants_hacs else 'excluded'}, audio {'included' if wants_audio else 'excluded'}."
            if wants_audio:
                if wants_hacs:
                    return "esp32_notifier_hacs" if wants_web else "esp32_notifier_hacs_slim"
                return "esp32_notifier" if wants_web else "esp32_notifier_slim"
            return "esp32_designer_noaudio" + ("_hacs" if wants_hacs else "") + ("_slim" if not wants_web else "")
        raise RuntimeError(f"ELMA firmware generation does not yet support {detected.upper()}.")

    def run_job(self, job: DesignerJob, payload: dict) -> None:
        try:
            job.state = "running"
            port = str(payload["port"])
            self.set_job(job, 3, f"Detecting the ESP on {port}")
            detected, flash_size = self.flasher._detect_target_chip(port)
            requested_chip = str(payload.get("chip", "auto"))
            if requested_chip != "auto" and requested_chip != detected:
                raise RuntimeError(f"Manual target {requested_chip.upper()} does not match detected {detected.upper()}. Nothing was erased.")
            job.append(f"Detected {CHIP_FAMILIES.get(detected, detected)}; flash {flash_size or 'size reported by loader'}")
            profile = self.resolve_profile(detected, payload.get("capabilities", {}), payload.get("settings", {}), job)
            if job.cancelled:
                raise InterruptedError("Build cancelled")
            project = self.project_root()
            self.set_job(job, 12, f"Compiling {profile} with maximum compatible functionality")
            command = self.compiler_command() + ["run", "--project-dir", str(project), "--environment", profile]
            job.append(" ".join(command))
            creation_flags = subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
            compiler_environment = os.environ.copy()
            compiler_environment["ELMA_PORTABLE_BUILDER"] = "1"
            job.process = subprocess.Popen(command, cwd=project, env=compiler_environment, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace", creationflags=creation_flags)
            assert job.process.stdout is not None
            for line in job.process.stdout:
                job.append(line)
                if "Compiling" in line and job.progress < 55:
                    job.progress += 1
                if job.cancelled:
                    job.process.terminate()
                    raise InterruptedError("Build cancelled")
            code = job.process.wait()
            job.process = None
            if code:
                raise RuntimeError(f"Firmware compilation failed with exit code {code}. See the build log above.")
            build = project / ".pio" / "build" / profile
            application = (build / "firmware.bin").read_bytes()
            family = chip_family_from_image(application)
            if family != detected:
                raise RuntimeError("Compiler output chip family does not match the connected target")
            flash_mb = int(re.search(r"(\d+)", flash_size).group(1)) if re.search(r"(\d+)", flash_size) else 4
            if len(application) > min(MAX_APPLICATION_SIZE, flash_mb * 1024 * 1024):
                raise RuntimeError(f"Generated application is {len(application):,} bytes and does not fit this target safely.")
            job.append(f"Generated application: {len(application):,} bytes")
            if job.cancelled:
                raise InterruptedError("Build cancelled before erase")
            boot_address = 0 if family in ("esp32s3", "esp32c3") else 0x1000
            parts = [(boot_address, (build / "bootloader.bin").read_bytes()), (0x8000, (build / "partitions.bin").read_bytes()), (APPLICATION_ADDRESS, application)]
            self.set_job(job, 66, "Writing and verifying firmware")
            self.flasher._write_flash(port, family, parts, bool(payload.get("erase", True)))
            configuration = sanitize_clone_configuration(payload.get("settings", self.settings))
            self.settings = payload.get("settings", self.settings)
            self.set_job(job, 93, "Provisioning Wi-Fi, MQTT, identity and peripheral configuration")
            wifi = configuration.get("wifi", {})
            job.ip_address = self.flasher._provision(port, configuration, bool(str(wifi.get("ssid", "")).strip()))
            job.progress = 100
            job.status = "Compile, flash and configuration complete"
            job.state = "complete"
            job.append("Target device identity and MQTT IDs were regenerated from its own hardware ID.")
        except InterruptedError as error:
            job.state = "cancelled"
            job.status = str(error)
            job.append(job.status)
        except BaseException as error:
            job.state = "failed"
            job.error = friendly_error(error)
            job.status = "Build or flash failed"
            job.append(f"ERROR: {job.error}")


def run_native_designer_window(url: str, icon_path: pathlib.Path, smoke_test: bool = False) -> bool:
    """Render the local designer in ELMA's bundled Qt WebEngine window."""
    from PySide6.QtCore import QTimer, QUrl
    from PySide6.QtGui import QIcon
    from PySide6.QtWebEngineCore import QWebEnginePage, QWebEngineProfile
    from PySide6.QtWebEngineWidgets import QWebEngineView
    from PySide6.QtWidgets import QApplication, QMainWindow

    origin = urllib.parse.urlparse(url)

    class LocalDesignerPage(QWebEnginePage):
        def acceptNavigationRequest(self, target: QUrl, navigation_type, is_main_frame: bool) -> bool:
            if not is_main_frame:
                return True
            parsed = urllib.parse.urlparse(target.toString())
            return parsed.scheme in ("http", "https") and parsed.hostname == origin.hostname and parsed.port == origin.port

        def createWindow(self, _window_type):
            return None

    qt_app = QApplication.instance() or QApplication(["ELMA Device Designer"])
    qt_app.setApplicationName("ELMA Device Designer")
    qt_app.setOrganizationName("ELMA IoT")
    qt_app.setApplicationVersion(APP_VERSION)
    qt_app.setStyle("Fusion")
    icon = QIcon(str(icon_path))
    qt_app.setWindowIcon(icon)

    profile = QWebEngineProfile.defaultProfile()
    profile.setPersistentCookiesPolicy(QWebEngineProfile.PersistentCookiesPolicy.NoPersistentCookies)
    profile.setHttpCacheType(QWebEngineProfile.HttpCacheType.MemoryHttpCache)

    window = QMainWindow()
    window.setWindowTitle(f"ELMA Device Designer v{APP_VERSION}")
    window.setWindowIcon(icon)
    window.resize(1280, 900)
    window.setMinimumSize(960, 680)
    view = QWebEngineView(window)
    page = LocalDesignerPage(profile, view)
    view.setPage(page)
    window.setCentralWidget(view)

    result = {"loaded": False}

    def finish_smoke_test() -> None:
        window.close()
        qt_app.quit()

    def loaded(ok: bool) -> None:
        result["loaded"] = bool(ok)
        if smoke_test:
            QTimer.singleShot(100, finish_smoke_test)
        elif not ok:
            view.setHtml(
                "<html><body style='font:16px Segoe UI;background:#f7f5ef;color:#2a2926;padding:40px'>"
                "<h1>ELMA Device Designer could not start</h1>"
                "<p>The bundled Designer interface did not load. Close this window and retry.</p>"
                "</body></html>"
            )

    view.loadFinished.connect(loaded)
    if smoke_test:
        QTimer.singleShot(15000, finish_smoke_test)
    else:
        window.showMaximized()
    view.setUrl(QUrl(url))
    window.show() if smoke_test else None
    qt_app.exec()
    view.deleteLater()
    window.deleteLater()
    qt_app.processEvents()
    return result["loaded"]


class FlasherApplication:
    def __init__(self, root: tk.Tk, auto_detect_chip: bool = True) -> None:
        self.root = root
        self.auto_detect_chip = auto_detect_chip
        self.designer_server = DesignerServer(self)
        self.events: queue.Queue[tuple] = queue.Queue()
        self.busy = False
        self.last_ip = ""
        self.mode = tk.StringVar(value="clone")
        self.erase = tk.StringVar(value="yes")
        self.source_ip = tk.StringVar(value="")
        self.username = tk.StringVar(value="")
        self.password = tk.StringVar(value="")
        self.firmware_file = tk.StringVar(value="")
        self.port = tk.StringVar(value="")
        self.chip_choice = tk.StringVar(value="auto")
        self.chip_choice_label = tk.StringVar(value=CHIP_CHOICES["auto"])
        self.detected_chip = tk.StringVar(value="Detected: not checked")
        self.firmware_family = tk.StringVar(value="Firmware: not selected")
        self.preconfigure_enabled = tk.BooleanVar(value=False)
        self.preconfigure_summary = tk.StringVar(value="Disabled — device or clone defaults will be used")
        self.preconfigure_values: dict[str, object] = {
            "friendly_name": "",
            "wifi_ssid": "",
            "wifi_password": "",
            "use_static_ip": False,
            "static_ip": "",
            "gateway": "",
            "subnet": "",
            "dns1": "",
            "dns2": "",
            "mqtt_host": "",
            "mqtt_port": "",
            "mqtt_username": "",
            "mqtt_password": "",
            "mqtt_discovery": "default",
            "ap_ssid": "",
            "ap_password": "",
            "ap_fallback": "default",
            "web_auth": "default",
            "web_username": "",
            "web_password": "",
        }
        self.selected_image_family = ""
        self.detected_family = ""
        self.detecting_chip = False
        self.esptool_lock = threading.Lock()
        self.status = tk.StringVar(value="Ready to flash another ESP device")
        self.detail = tk.StringVar(value="Connect the target using a USB data cable, then select its COM port.")
        self.progress = 0
        self._configure_window()
        self.root.protocol("WM_DELETE_WINDOW", self.close)
        self._build_ui()
        self.refresh_ports()
        self.root.after(80, self._process_events)

    def _configure_window(self) -> None:
        self.root.title(f"ELMA Flasher v{APP_VERSION}")
        self.window_icon_path = resource_path("assets/ELMA-Flasher.ico")
        self.root.iconbitmap(default=str(self.window_icon_path))
        self.window_icon_applied = True
        self.root.geometry("860x760")
        self.root.minsize(760, 690)
        self.root.configure(bg=PAPER)
        style = ttk.Style(self.root)
        style.theme_use("clam")
        style.configure("TCombobox", fieldbackground=WHITE, background=WHITE, padding=8)

    def _build_ui(self) -> None:
        header = tk.Frame(self.root, bg=DARK, height=86)
        header.pack(fill="x")
        header.pack_propagate(False)
        logo = tk.Canvas(header, width=54, height=54, bg=DARK, highlightthickness=0)
        logo.pack(side="left", padx=(24, 14), pady=16)
        logo.create_oval(4, 4, 50, 50, fill=ORANGE, outline=ORANGE)
        logo.create_text(27, 27, text="E", fill=WHITE, font=("Segoe UI", 23, "bold"))
        titles = tk.Frame(header, bg=DARK)
        titles.pack(side="left", pady=14)
        tk.Label(titles, text="ELMA Flasher", bg=DARK, fg=WHITE, font=("Segoe UI", 22, "bold")).pack(anchor="w")
        tk.Label(titles, text="Portable ESP32 / ESP32-S3 / ESP32-C3 designer, compiler and flasher", bg=DARK, fg="#d9d5ce", font=("Segoe UI", 10)).pack(anchor="w")
        tk.Label(header, text=f"v{APP_VERSION}", bg=ORANGE, fg=WHITE, font=("Segoe UI", 10, "bold"), padx=12, pady=6).pack(side="right", padx=24)

        # Reserve the primary action before the expanding body so Windows display
        # scaling can never push the Flash button below the visible client area.
        footer = tk.Frame(self.root, bg=PAPER)
        footer.pack(side="bottom", fill="x", padx=22, pady=(0, 16))
        self.designer_button = tk.Button(footer, text="Open Device Designer — Configure, Compile & Flash", command=self.open_designer, bg=DARK, fg=WHITE, activebackground="#46433d", activeforeground=WHITE, relief="flat", font=("Segoe UI", 11, "bold"), pady=10)
        self.designer_button.pack(fill="x", pady=(0, 8))
        self.flash_button = tk.Button(footer, text="Flash USB Device", command=self.start, bg=ORANGE, fg=WHITE, activebackground="#d97e00", activeforeground=WHITE, disabledforeground="#ddd8ce", relief="flat", font=("Segoe UI", 12, "bold"), pady=11)
        self.flash_button.pack(fill="x")

        body = tk.Frame(self.root, bg=PAPER)
        body.pack(side="top", fill="both", expand=True, padx=22, pady=(18, 12))

        options = tk.LabelFrame(body, text=" Firmware source ", bg=WHITE, fg=DARK, font=("Segoe UI", 11, "bold"), bd=1, relief="solid", padx=14, pady=10)
        options.pack(fill="x")
        tk.Radiobutton(options, variable=self.mode, value="clone", command=self._update_mode, text="Clone Current Device", bg=WHITE, activebackground=WHITE, selectcolor=WHITE, fg=DARK, font=("Segoe UI", 11, "bold")).grid(row=0, column=0, sticky="w")
        tk.Label(options, text="Copies firmware, Wi-Fi, MQTT and configuration; target identity is regenerated from its hardware ID.", bg=WHITE, fg=MUTED, font=("Segoe UI", 9), wraplength=690, justify="left").grid(row=1, column=0, columnspan=4, sticky="w", padx=(24, 0), pady=(0, 8))
        tk.Label(options, text="Device IP", bg=WHITE, fg=DARK).grid(row=2, column=0, sticky="w")
        self.source_entry = tk.Entry(options, textvariable=self.source_ip, relief="solid", bd=1, font=("Segoe UI", 10))
        self.source_entry.grid(row=2, column=1, sticky="ew", padx=(8, 14), ipady=6)
        tk.Label(options, text="Web user", bg=WHITE, fg=DARK).grid(row=2, column=2, sticky="w")
        self.user_entry = tk.Entry(options, textvariable=self.username, relief="solid", bd=1, width=13)
        self.user_entry.grid(row=2, column=3, padx=(8, 10), ipady=6)
        tk.Label(options, text="Password", bg=WHITE, fg=DARK).grid(row=2, column=4, sticky="w")
        self.password_entry = tk.Entry(options, textvariable=self.password, show="•", relief="solid", bd=1, width=13)
        self.password_entry.grid(row=2, column=5, padx=(8, 0), ipady=6)

        tk.Radiobutton(options, variable=self.mode, value="file", command=self._update_mode, text="Flash From File", bg=WHITE, activebackground=WHITE, selectcolor=WHITE, fg=DARK, font=("Segoe UI", 11, "bold")).grid(row=3, column=0, sticky="w", pady=(12, 0))
        self.file_entry = tk.Entry(options, textvariable=self.firmware_file, state="disabled", relief="solid", bd=1, font=("Segoe UI", 9))
        self.file_entry.grid(row=4, column=0, columnspan=5, sticky="ew", padx=(24, 8), ipady=6)
        self.browse_button = tk.Button(options, text="Browse…", command=self.choose_file, state="disabled", bg="#eceae5", fg=DARK, relief="solid", bd=1, padx=14, pady=5)
        self.browse_button.grid(row=4, column=5, sticky="ew")
        self.file_entry.bind("<FocusOut>", lambda _event: self._inspect_selected_firmware(False))
        self.file_entry.bind("<Return>", lambda _event: self._inspect_selected_firmware(True))
        tk.Checkbutton(options, text="Preconfigure target", variable=self.preconfigure_enabled, command=self._update_preconfigure_summary, bg=WHITE, activebackground=WHITE, selectcolor=WHITE, fg=DARK, font=("Segoe UI", 10, "bold")).grid(row=5, column=0, sticky="w", pady=(12, 0))
        tk.Label(options, textvariable=self.preconfigure_summary, bg=WHITE, fg=MUTED, font=("Segoe UI", 8), anchor="w").grid(row=5, column=1, columnspan=4, sticky="ew", padx=(8, 8), pady=(12, 0))
        tk.Button(options, text="Configure…", command=self.open_preconfiguration, bg="#eceae5", fg=DARK, relief="solid", bd=1, padx=14, pady=5).grid(row=5, column=5, sticky="ew", pady=(12, 0))
        options.columnconfigure(1, weight=1)
        options.columnconfigure(3, weight=1)

        target = tk.Frame(body, bg=PAPER)
        target.pack(fill="x", pady=14)
        port_card = tk.LabelFrame(target, text=" Target USB device ", bg=WHITE, fg=DARK, font=("Segoe UI", 11, "bold"), bd=1, relief="solid", padx=12, pady=10)
        port_card.pack(side="left", fill="both", expand=True, padx=(0, 7))
        self.port_combo = ttk.Combobox(port_card, textvariable=self.port, state="readonly", font=("Segoe UI", 10))
        self.port_combo.pack(side="left", fill="x", expand=True)
        self.port_combo.bind("<<ComboboxSelected>>", lambda _event: self.detect_selected_chip())
        tk.Button(port_card, text="Refresh", command=self.refresh_ports, bg="#eceae5", fg=DARK, relief="solid", bd=1, padx=12, pady=6).pack(side="left", padx=(8, 0))

        chip_card = tk.LabelFrame(target, text=" Target chip ", bg=WHITE, fg=DARK, font=("Segoe UI", 11, "bold"), bd=1, relief="solid", padx=12, pady=7)
        chip_card.pack(side="left", fill="both", expand=True, padx=7)
        self.chip_button = tk.Menubutton(chip_card, textvariable=self.chip_choice_label, bg="#eceae5", fg=DARK, activebackground="#e0ddd6", relief="solid", bd=1, padx=10, pady=5, indicatoron=True)
        self.chip_menu = tk.Menu(self.chip_button, tearoff=False)
        self.chip_button.configure(menu=self.chip_menu)
        for family, label in CHIP_CHOICES.items():
            self.chip_menu.add_radiobutton(label=label, variable=self.chip_choice, value=family, command=self._update_chip_choice_label)
        self.chip_button.pack(fill="x")
        self.detected_chip_label = tk.Label(chip_card, textvariable=self.detected_chip, bg=WHITE, fg=MUTED, font=("Segoe UI", 8), anchor="w")
        self.detected_chip_label.pack(fill="x", pady=(4, 0))
        tk.Label(chip_card, textvariable=self.firmware_family, bg=WHITE, fg=MUTED, font=("Segoe UI", 8), anchor="w").pack(fill="x")

        erase_card = tk.LabelFrame(target, text=" Clean target before flashing? ", bg=WHITE, fg=DARK, font=("Segoe UI", 11, "bold"), bd=1, relief="solid", padx=12, pady=8)
        erase_card.pack(side="left", fill="both", expand=True, padx=(7, 0))
        tk.Radiobutton(erase_card, text="Yes — full erase", variable=self.erase, value="yes", bg=WHITE, activebackground=WHITE, selectcolor=WHITE).pack(side="left")
        tk.Radiobutton(erase_card, text="No — preserve", variable=self.erase, value="no", bg=WHITE, activebackground=WHITE, selectcolor=WHITE).pack(side="left", padx=(16, 0))

        progress_card = tk.Frame(body, bg=WHITE, highlightbackground="#d7d3ca", highlightthickness=1)
        progress_card.pack(fill="x", pady=(0, 14))
        self.progress_canvas = tk.Canvas(progress_card, width=130, height=130, bg=WHITE, highlightthickness=0)
        self.progress_canvas.pack(side="left", padx=18, pady=10)
        self.progress_canvas.create_oval(18, 18, 112, 112, outline="#e5e1d8", width=11)
        self.progress_arc = self.progress_canvas.create_arc(18, 18, 112, 112, start=90, extent=0, outline=ORANGE, width=11, style="arc")
        self.progress_text = self.progress_canvas.create_text(65, 64, text="0%", fill=DARK, font=("Segoe UI", 18, "bold"))
        progress_copy = tk.Frame(progress_card, bg=WHITE)
        progress_copy.pack(side="left", fill="both", expand=True, pady=22, padx=(0, 16))
        tk.Label(progress_copy, textvariable=self.status, bg=WHITE, fg=DARK, font=("Segoe UI", 13, "bold"), anchor="w").pack(fill="x")
        tk.Label(progress_copy, textvariable=self.detail, bg=WHITE, fg=MUTED, font=("Segoe UI", 10), anchor="w", justify="left", wraplength=600).pack(fill="x", pady=(6, 0))
        self.open_button = tk.Button(progress_copy, text="Open cloned device", command=self.open_target, bg=GREEN, fg=WHITE, activebackground=GREEN, activeforeground=WHITE, relief="flat", padx=12, pady=7)

        log_frame = tk.Frame(body, bg=WHITE, highlightbackground="#d7d3ca", highlightthickness=1)
        log_frame.pack(fill="both", expand=True)
        self.log = tk.Text(log_frame, height=9, bg="#fbfaf7", fg=DARK, relief="flat", font=("Consolas", 9), padx=12, pady=10, state="disabled", wrap="word")
        self.log.pack(side="left", fill="both", expand=True)
        scrollbar = ttk.Scrollbar(log_frame, command=self.log.yview)
        scrollbar.pack(side="right", fill="y")
        self.log.configure(yscrollcommand=scrollbar.set)

    def _update_mode(self) -> None:
        state = "normal" if self.mode.get() == "file" else "disabled"
        self.file_entry.configure(state=state)
        self.browse_button.configure(state=state)
        clone_state = "normal" if self.mode.get() == "clone" else "disabled"
        for control in (self.source_entry, self.user_entry, self.password_entry):
            control.configure(state=clone_state)
        if self.mode.get() == "file":
            self._inspect_selected_firmware(False)
        else:
            self._set_selected_image_family("")

    def _update_chip_choice_label(self) -> None:
        choice = self.chip_choice.get()
        self.chip_choice_label.set(CHIP_CHOICES.get(choice, CHIP_CHOICES["auto"]))

    def _set_selected_image_family(self, family: str) -> None:
        self.selected_image_family = family if family in CHIP_FAMILIES else ""
        if self.selected_image_family:
            self.firmware_family.set(f"Firmware: {CHIP_FAMILIES[self.selected_image_family]}")
        elif self.mode.get() == "clone":
            self.firmware_family.set("Firmware: determined from source")
        else:
            self.firmware_family.set("Firmware: not selected")
        for index, candidate in enumerate(CHIP_FAMILIES, start=1):
            compatible = not self.selected_image_family or candidate == self.selected_image_family
            self.chip_menu.entryconfigure(index, state="normal" if compatible else "disabled")
        if self.chip_choice.get() not in ("auto", self.selected_image_family) and self.selected_image_family:
            self.chip_choice.set("auto")
            self._update_chip_choice_label()

    def _inspect_selected_firmware(self, show_error: bool) -> None:
        if self.mode.get() != "file":
            return
        value = self.firmware_file.get().strip()
        if not value:
            self._set_selected_image_family("")
            return
        try:
            path = pathlib.Path(value)
            with path.open("rb") as stream:
                family = chip_family_from_image(stream.read(24))
            self._set_selected_image_family(family)
        except (OSError, ValueError) as error:
            self._set_selected_image_family("")
            self.firmware_family.set("Firmware: invalid or unsupported")
            if show_error:
                messagebox.showerror("ELMA Flasher", str(error))

    def _update_preconfigure_summary(self) -> None:
        if not self.preconfigure_enabled.get():
            self.preconfigure_summary.set("Disabled — device or clone defaults will be used")
            return
        try:
            overrides = self._preconfiguration_overrides(self.preconfigure_values)
            fields = sum(len(values) for values in overrides.values() if isinstance(values, dict))
            self.preconfigure_summary.set(f"Enabled — {fields} explicit override{'s' if fields != 1 else ''}; blank fields use device defaults")
        except ValueError:
            self.preconfigure_summary.set("Enabled — configuration needs correction")

    @staticmethod
    def _preconfiguration_overrides(values: dict[str, object]) -> dict:
        text = {key: str(value).strip() for key, value in values.items() if key != "use_static_ip"}
        overrides: dict[str, dict] = {}

        friendly_name = text.get("friendly_name", "")
        if len(friendly_name) > 64:
            raise ValueError("Friendly device name must be 64 characters or fewer.")
        if friendly_name:
            overrides.setdefault("device", {})["friendlyName"] = friendly_name

        ssid = text.get("wifi_ssid", "")
        wifi_password = text.get("wifi_password", "")
        if len(ssid) > 32:
            raise ValueError("Wi-Fi SSID must be 32 characters or fewer.")
        if len(wifi_password) > 63:
            raise ValueError("Wi-Fi password must be 63 characters or fewer.")
        if wifi_password and not ssid:
            raise ValueError("Enter a Wi-Fi SSID when supplying a Wi-Fi password.")
        if ssid:
            wifi = overrides.setdefault("wifi", {})
            wifi["ssid"] = ssid
            wifi["password"] = wifi_password

        use_static_ip = bool(values.get("use_static_ip", False))
        if use_static_ip:
            required = {"staticIp": text.get("static_ip", ""), "gateway": text.get("gateway", ""), "subnet": text.get("subnet", "")}
            if not all(required.values()):
                raise ValueError("Static IP, gateway and subnet are required when static addressing is enabled.")
            for label, value in {**required, "dns1": text.get("dns1", ""), "dns2": text.get("dns2", "")}.items():
                if value:
                    try:
                        if ipaddress.ip_address(value).version != 4:
                            raise ValueError
                    except ValueError as error:
                        raise ValueError(f"{label} must be a valid IPv4 address.") from error
            wifi = overrides.setdefault("wifi", {})
            wifi.update({"useStaticIp": True, **required})
            if text.get("dns1"):
                wifi["dns1"] = text["dns1"]
            if text.get("dns2"):
                wifi["dns2"] = text["dns2"]

        mqtt_fields = {
            "host": text.get("mqtt_host", ""),
            "username": text.get("mqtt_username", ""),
            "password": text.get("mqtt_password", ""),
        }
        for key, value in mqtt_fields.items():
            if value:
                overrides.setdefault("mqtt", {})[key] = value
        mqtt_port = text.get("mqtt_port", "")
        if mqtt_port:
            try:
                port = int(mqtt_port)
            except ValueError as error:
                raise ValueError("MQTT port must be a number from 1 to 65535.") from error
            if not 1 <= port <= 65535:
                raise ValueError("MQTT port must be a number from 1 to 65535.")
            overrides.setdefault("mqtt", {})["port"] = port
        mqtt_discovery = text.get("mqtt_discovery", "default")
        if mqtt_discovery in ("enabled", "disabled"):
            overrides.setdefault("mqtt", {})["discoveryEnabled"] = mqtt_discovery == "enabled"

        ap_ssid = text.get("ap_ssid", "")
        ap_password = text.get("ap_password", "")
        if len(ap_ssid) > 32:
            raise ValueError("Fallback AP name must be 32 characters or fewer.")
        if ap_password and len(ap_password) < 8:
            raise ValueError("Fallback AP password must contain at least 8 characters.")
        if ap_ssid:
            overrides.setdefault("wifi", {})["apSsid"] = ap_ssid
        if ap_password:
            overrides.setdefault("wifi", {})["apPassword"] = ap_password
        ap_fallback = text.get("ap_fallback", "default")
        if ap_fallback in ("enabled", "disabled"):
            overrides.setdefault("wifi", {})["apFallbackEnabled"] = ap_fallback == "enabled"

        web_auth = text.get("web_auth", "default")
        web_username = text.get("web_username", "")
        web_password = text.get("web_password", "")
        if web_auth == "enabled" and (not web_username or not web_password):
            raise ValueError("Web username and password are required when web authentication is enabled.")
        if web_auth in ("enabled", "disabled"):
            web = overrides.setdefault("webAuth", {})
            web["enabled"] = web_auth == "enabled"
            if web_username:
                web["username"] = web_username
            if web_password:
                web["password"] = web_password
        return overrides

    def open_preconfiguration(self) -> None:
        dialog = tk.Toplevel(self.root)
        dialog.title("Preconfigure target — ELMA Flasher")
        dialog.geometry("640x610")
        dialog.minsize(600, 560)
        dialog.configure(bg=PAPER)
        dialog.transient(self.root)
        dialog.grab_set()
        dialog.iconbitmap(default=str(self.window_icon_path))

        header = tk.Frame(dialog, bg=DARK, height=64)
        header.pack(fill="x")
        header.pack_propagate(False)
        tk.Label(header, text="Preconfigure target", bg=DARK, fg=WHITE, font=("Segoe UI", 17, "bold")).pack(anchor="w", padx=20, pady=(10, 0))
        tk.Label(header, text="Blank fields retain the flashed device or cloned configuration defaults.", bg=DARK, fg="#d9d5ce", font=("Segoe UI", 9)).pack(anchor="w", padx=20)

        local: dict[str, tk.Variable] = {}
        for key, value in self.preconfigure_values.items():
            local[key] = tk.BooleanVar(value=bool(value)) if key == "use_static_ip" else tk.StringVar(value=str(value))

        notebook = ttk.Notebook(dialog)
        notebook.pack(fill="both", expand=True, padx=18, pady=16)

        def page(title: str) -> tk.Frame:
            frame = tk.Frame(notebook, bg=WHITE, padx=18, pady=16)
            frame.columnconfigure(1, weight=1)
            notebook.add(frame, text=title)
            return frame

        def field(parent: tk.Frame, row: int, label: str, key: str, secret: bool = False) -> tk.Entry:
            tk.Label(parent, text=label, bg=WHITE, fg=DARK, anchor="w").grid(row=row, column=0, sticky="w", padx=(0, 12), pady=6)
            entry = tk.Entry(parent, textvariable=local[key], show="•" if secret else "", relief="solid", bd=1)
            entry.grid(row=row, column=1, sticky="ew", pady=6, ipady=5)
            return entry

        network = page("Identity & Wi-Fi")
        tk.Label(network, text="Hardware identity", bg=WHITE, fg=DARK, font=("Segoe UI", 10, "bold")).grid(row=0, column=0, sticky="w", pady=(0, 6))
        tk.Label(network, text="Generated from the target chip hardware ID — never cloned or editable", bg=WHITE, fg=GREEN, anchor="w").grid(row=0, column=1, sticky="w", pady=(0, 6))
        field(network, 1, "Friendly device name", "friendly_name")
        field(network, 2, "Wi-Fi SSID", "wifi_ssid")
        field(network, 3, "Wi-Fi password", "wifi_password", True)
        tk.Checkbutton(network, text="Use a new static IP (source IP is never cloned)", variable=local["use_static_ip"], bg=WHITE, activebackground=WHITE, selectcolor=WHITE).grid(row=4, column=0, columnspan=2, sticky="w", pady=(10, 2))
        field(network, 5, "Static IP", "static_ip")
        field(network, 6, "Gateway", "gateway")
        field(network, 7, "Subnet", "subnet")
        field(network, 8, "DNS 1", "dns1")
        field(network, 9, "DNS 2", "dns2")

        mqtt = page("MQTT")
        tk.Label(mqtt, text="MQTT client ID and base topic stay tied to the target hardware ID.", bg=WHITE, fg=GREEN, anchor="w", wraplength=500, justify="left").grid(row=0, column=0, columnspan=2, sticky="w", pady=(0, 10))
        field(mqtt, 1, "Broker host", "mqtt_host")
        field(mqtt, 2, "Broker port", "mqtt_port")
        field(mqtt, 3, "Username", "mqtt_username")
        field(mqtt, 4, "Password", "mqtt_password", True)
        tk.Label(mqtt, text="Home Assistant discovery", bg=WHITE, fg=DARK).grid(row=5, column=0, sticky="w", pady=6)
        ttk.Combobox(mqtt, textvariable=local["mqtt_discovery"], state="readonly", values=("default", "enabled", "disabled")).grid(row=5, column=1, sticky="ew", pady=6)

        access = page("Fallback AP & Web")
        field(access, 0, "Fallback AP name", "ap_ssid")
        field(access, 1, "Fallback AP password", "ap_password", True)
        tk.Label(access, text="Fallback AP", bg=WHITE, fg=DARK).grid(row=2, column=0, sticky="w", pady=6)
        ttk.Combobox(access, textvariable=local["ap_fallback"], state="readonly", values=("default", "enabled", "disabled")).grid(row=2, column=1, sticky="ew", pady=6)
        tk.Label(access, text="Web authentication", bg=WHITE, fg=DARK).grid(row=3, column=0, sticky="w", pady=(18, 6))
        ttk.Combobox(access, textvariable=local["web_auth"], state="readonly", values=("default", "enabled", "disabled")).grid(row=3, column=1, sticky="ew", pady=(18, 6))
        field(access, 4, "Web username", "web_username")
        field(access, 5, "Web password", "web_password", True)

        footer = tk.Frame(dialog, bg=PAPER)
        footer.pack(fill="x", padx=18, pady=(0, 16))

        def save() -> None:
            values = {key: variable.get() for key, variable in local.items()}
            try:
                self._preconfiguration_overrides(values)
            except ValueError as error:
                messagebox.showerror("ELMA Flasher", str(error), parent=dialog)
                return
            self.preconfigure_values = values
            self.preconfigure_enabled.set(True)
            self._update_preconfigure_summary()
            dialog.destroy()

        tk.Button(footer, text="Save & Enable", command=save, bg=ORANGE, fg=WHITE, activebackground="#d97e00", activeforeground=WHITE, relief="flat", font=("Segoe UI", 11, "bold"), pady=8).pack(side="right", fill="x", expand=True, padx=(8, 0))
        tk.Button(footer, text="Cancel", command=dialog.destroy, bg="#eceae5", fg=DARK, relief="solid", bd=1, pady=8).pack(side="left", fill="x", expand=True, padx=(0, 8))

    def choose_file(self) -> None:
        value = filedialog.askopenfilename(title="Select ELMA firmware", filetypes=[("ESP32 firmware", "*.bin"), ("All files", "*.*")])
        if value:
            self.firmware_file.set(value)
            self._inspect_selected_firmware(True)

    def _selected_port(self) -> str:
        return self.port.get().split(" — ", 1)[0].strip()

    def refresh_ports(self) -> None:
        ports = sorted(list_ports.comports(), key=lambda item: item.device)
        labels = [f"{item.device} — {item.description}" for item in ports]
        self.port_combo["values"] = labels
        current_device = self.port.get().split(" — ", 1)[0]
        if current_device:
            matching = next((label for label in labels if label.startswith(f"{current_device} —")), "")
            self.port.set(matching)
        if not self.port.get() and labels:
            self.port.set(labels[0])
        if self.port.get() and self.auto_detect_chip:
            self.root.after(50, self.detect_selected_chip)
        if not labels:
            self.port.set("")
            self.detected_family = ""
            self.detected_chip.set("Detected: no serial device")
            self.detected_chip_label.configure(fg=RED)
            self._set_status(0, "No USB serial device detected", "Connect the ESP with a data-capable USB cable, allow Windows to install its driver, then press Refresh.", RED)

    def detect_selected_chip(self) -> None:
        port = self._selected_port()
        if not port or self.detecting_chip or self.busy:
            return
        self.detecting_chip = True
        self.detected_family = ""
        self.detected_chip.set("Detected: checking…")
        self.detected_chip_label.configure(fg=ORANGE)
        threading.Thread(target=self._detect_chip_worker, args=(port,), daemon=True).start()

    def _detect_chip_worker(self, port: str) -> None:
        try:
            model, flash_size = self._detect_target_chip(port)
            self._emit("chip_detected", model, flash_size)
        except BaseException as error:
            self._emit("chip_detection_error", friendly_error(error))

    def _emit(self, kind: str, *values) -> None:
        self.events.put((kind, *values))

    def _log(self, value: str) -> None:
        self._emit("log", value)

    def _set_status(self, percent: int, status: str, detail: str, color: str = ORANGE) -> None:
        self.progress = max(0, min(100, int(percent)))
        self.progress_canvas.itemconfigure(self.progress_arc, extent=-3.6 * self.progress, outline=color)
        self.progress_canvas.itemconfigure(self.progress_text, text=f"{self.progress}%")
        self.status.set(status)
        self.detail.set(detail)

    def _process_events(self) -> None:
        try:
            while True:
                event = self.events.get_nowait()
                if event[0] == "log":
                    self.log.configure(state="normal")
                    self.log.insert("end", f"{event[1]}\n")
                    self.log.see("end")
                    self.log.configure(state="disabled")
                elif event[0] == "status":
                    self._set_status(*event[1:])
                elif event[0] == "chip_detected":
                    self.detecting_chip = False
                    self.detected_family = event[1]
                    model_label = KNOWN_CHIP_MODELS.get(event[1], event[1].upper())
                    flash_label = f" · {event[2]}" if event[2] else ""
                    unsupported = event[1] not in CHIP_FAMILIES
                    self.detected_chip.set(f"Detected: {model_label}{flash_label}{' (unsupported)' if unsupported else ''}")
                    self.detected_chip_label.configure(fg=RED if unsupported else GREEN)
                elif event[0] == "chip_detection_error":
                    self.detecting_chip = False
                    self.detected_family = ""
                    self.detected_chip.set("Detected: unavailable")
                    self.detected_chip_label.configure(fg=RED)
                    self._log(f"Chip detection: {event[1]}")
                elif event[0] == "firmware_family":
                    self._set_selected_image_family(event[1])
                elif event[0] == "complete":
                    self.busy = False
                    self.flash_button.configure(state="normal", text="Flash USB Device")
                    self.last_ip = event[1]
                    if self.last_ip:
                        self.open_button.pack(anchor="w", pady=(10, 0))
                    messagebox.showinfo("ELMA Flasher", event[2])
                elif event[0] == "error":
                    self.busy = False
                    self.flash_button.configure(state="normal", text="Retry Flash")
                    messagebox.showerror("ELMA Flasher", event[1])
        except queue.Empty:
            pass
        self.root.after(80, self._process_events)

    def start(self) -> None:
        if self.busy:
            return
        port = self._selected_port()
        if not port:
            messagebox.showerror("ELMA Flasher", "Select a connected USB serial device.")
            return
        if self.mode.get() == "file" and not self.firmware_file.get().strip():
            messagebox.showerror("ELMA Flasher", "Select an ESP32 application .bin file.")
            return
        try:
            preconfiguration = self._preconfiguration_overrides(self.preconfigure_values) if self.preconfigure_enabled.get() else {}
        except ValueError as error:
            messagebox.showerror("ELMA Flasher", str(error))
            return
        self.busy = True
        self.last_ip = ""
        self.open_button.pack_forget()
        self.log.configure(state="normal")
        self.log.delete("1.0", "end")
        self.log.configure(state="disabled")
        self.flash_button.configure(state="disabled", text="Flashing…")
        job = {
            "mode": self.mode.get(),
            "source_ip": self.source_ip.get(),
            "username": self.username.get(),
            "password": self.password.get(),
            "firmware_file": self.firmware_file.get(),
            "erase": self.erase.get() == "yes",
            "chip_choice": self.chip_choice.get(),
            "preconfiguration": preconfiguration,
        }
        threading.Thread(target=self._flash_worker, args=(port, job), daemon=True).start()

    def _http_path(self, value: str) -> str:
        parsed = urllib.parse.urlparse(value)
        return f"{parsed.path}?{parsed.query}" if parsed.query else parsed.path

    def _prepare_clone(self, job: dict) -> tuple[str, list[tuple[int, bytes]], dict]:
        client = HttpDeviceClient(job["source_ip"], job["username"], job["password"])
        self._emit("status", 4, "Reading source device", "Downloading clone manifest and saved configuration.", ORANGE)
        manifest = client.json("/api/usb-flasher/manifest")
        settings = client.json("/api/settings")
        family = str(manifest.get("chipFamily", "")).lower().replace("-", "")
        if family not in CHIP_FAMILIES:
            raise RuntimeError(f"Source device reported unsupported chip family {family or 'unknown'}.")
        parts: list[tuple[int, bytes]] = []
        source_parts = manifest.get("parts")
        if not isinstance(source_parts, list):
            raise RuntimeError("Source firmware clone manifest does not contain flash parts. Update the source device to a clone-capable ELMA firmware first.")
        for index, part in enumerate(source_parts):
            if not isinstance(part, dict) or part.get("name") not in ("bootloader", "partitions", "application"):
                continue
            source_url = str(part.get("sourceUrl", ""))
            data = client.binary(self._http_path(source_url), int(part.get("size", 0)))
            parts.append((int(part.get("address", 0)), data))
            self._emit("status", 5 + index * 3, "Reading source device", f"Downloaded {part.get('name')} ({len(data):,} bytes).", ORANGE)
        application = next((data for address, data in parts if address == APPLICATION_ADDRESS), b"")
        if chip_family_from_image(application) != family:
            raise RuntimeError("Source application image does not match its declared chip family.")
        return family, parts, sanitize_clone_configuration(settings)

    def _prepare_file(self, job: dict) -> tuple[str, list[tuple[int, bytes]], None]:
        path = pathlib.Path(str(job["firmware_file"]).strip())
        if not path.is_file() or path.suffix.lower() != ".bin":
            raise ValueError("Choose an existing .bin application image.")
        application = path.read_bytes()
        if len(application) > MAX_APPLICATION_SIZE:
            raise ValueError(f"Application image is larger than the {MAX_APPLICATION_SIZE:#x}-byte OTA slot.")
        family = chip_family_from_image(application)
        bootloader_address = 0x0000 if family in ("esp32s3", "esp32c3") else 0x1000
        asset_base = resource_path(f"assets/{family}")
        bootloader = (asset_base / "bootloader.bin").read_bytes()
        partitions = (asset_base / "partitions.bin").read_bytes()
        return family, [(bootloader_address, bootloader), (0x8000, partitions), (APPLICATION_ADDRESS, application)], None

    def _detect_target_chip(self, port: str) -> tuple[str, str]:
        lines: list[str] = []

        def capture(line: str) -> None:
            lines.append(line)
            self._log(line)

        bridge = EsptoolOutput(capture)
        arguments = ["--chip", "auto", "--port", port, "--baud", "115200", "--before", "default-reset", "--after", "hard-reset", "chip-id"]
        try:
            with self.esptool_lock, contextlib.redirect_stdout(bridge), contextlib.redirect_stderr(bridge):
                esptool.main(arguments)
        except SystemExit as error:
            if error.code not in (None, 0):
                raise RuntimeError(f"Automatic chip detection stopped with code {error.code}.") from error
        finally:
            bridge.flush()
        output = "\n".join(lines)
        return chip_family_from_esptool_output(output), flash_size_from_esptool_output(output)

    def _esptool(self, arguments: list[str]) -> None:
        bridge = EsptoolOutput(self._handle_esptool_line)
        try:
            with self.esptool_lock, contextlib.redirect_stdout(bridge), contextlib.redirect_stderr(bridge):
                esptool.main(arguments)
        except SystemExit as error:
            if error.code not in (None, 0):
                raise RuntimeError(f"Espressif flashing engine stopped with code {error.code}.") from error
        finally:
            bridge.flush()

    def _handle_esptool_line(self, line: str) -> None:
        self._log(line)
        match = re.search(r"\((\d+) %\)", line)
        if match:
            self._emit("status", 25 + int(match.group(1)) * 0.65, "Flashing firmware", line, ORANGE)
        elif "Hash of data verified" in line:
            self._emit("status", 90, "Firmware verified", "Flash hashes verified successfully.", ORANGE)

    def _write_flash(self, port: str, family: str, parts: list[tuple[int, bytes]], erase: bool) -> None:
        with tempfile.TemporaryDirectory(prefix="elma-flasher-") as temp_dir:
            paths: list[tuple[int, pathlib.Path]] = []
            for index, (address, data) in enumerate(parts):
                path = pathlib.Path(temp_dir) / f"part-{index}.bin"
                path.write_bytes(data)
                paths.append((address, path))
            ota_path = pathlib.Path(temp_dir) / "ota-data-reset.bin"
            ota_path.write_bytes(bytes([0xFF]) * OTA_DATA_SIZE)
            paths.insert(max(0, len(paths) - 1), (OTA_DATA_ADDRESS, ota_path))
            common = ["--chip", family, "--port", port, "--baud", str(FLASH_BAUD), "--before", "default-reset"]
            if erase:
                self._emit("status", 18, "Erasing target flash", "Performing the requested full-chip erase.", ORANGE)
                self._esptool(common + ["--after", "no-reset", "erase-flash"])
            self._emit("status", 25, "Flashing firmware", "Writing bootloader, partitions, OTA selection and application.", ORANGE)
            write_arguments = common + ["--after", "hard-reset", "write-flash", "--flash-mode", "keep", "--flash-freq", "keep", "--flash-size", "detect"]
            for address, path in paths:
                write_arguments.extend([f"0x{address:X}", str(path)])
            self._esptool(write_arguments)

    def _provision(self, port: str, configuration: dict, expect_wifi_ip: bool) -> str:
        payload = json.dumps(configuration, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
        checksum = crc32(payload)
        header = f"ELMA_CLONE_CONFIG {len(payload)} {checksum:08X}\n".encode()
        deadline = time.monotonic() + PROVISION_TIMEOUT_SECONDS
        sent = False
        applied = False
        self._emit("status", 93, "Waiting for target firmware", "Opening the target's 115200-baud provisioning channel.", ORANGE)
        while time.monotonic() < deadline:
            try:
                with serial.Serial(port, CONSOLE_BAUD, timeout=1, write_timeout=5) as connection:
                    connection.reset_input_buffer()
                    connection.write(b"ELMA_CLONE_PING\n")
                    connection.flush()
                    while time.monotonic() < deadline:
                        raw = connection.readline()
                        if not raw:
                            connection.write(b"ELMA_CLONE_PING\n")
                            connection.flush()
                            continue
                        line = raw.decode("utf-8", "replace").strip()
                        if not line:
                            continue
                        self._log(line)
                        if not sent and "[clone] provisioning ready" in line:
                            self._emit("status", 94, "Copying configuration", "Sending Wi-Fi, MQTT, GPIO and peripheral settings.", ORANGE)
                            connection.write(header)
                            connection.write(payload)
                            connection.flush()
                            sent = True
                        if "[clone] error=" in line:
                            raise RuntimeError(line.split("error=", 1)[1])
                        if "[clone] configuration applied" in line:
                            applied = True
                            if not expect_wifi_ip:
                                return ""
                            self._emit("status", 97, "Configuration saved", "Target identity regenerated; waiting for Wi-Fi.", ORANGE)
                        match = re.search(r"\[wifi\].*station connected.*\bip=(\d{1,3}(?:\.\d{1,3}){3})", line, re.I)
                        if applied and match:
                            return match.group(1)
            except (serial.SerialException, OSError) as error:
                self._log(f"Serial reconnect: {error}")
                time.sleep(1)
        if not sent:
            raise RuntimeError("The new firmware booted, but its serial provisioning channel did not become ready.")
        if not applied:
            raise RuntimeError("The target did not confirm that cloned configuration was saved.")
        raise RuntimeError("Configuration was cloned, but the target did not report a Wi-Fi IP address within two minutes.")

    def _flash_worker(self, port: str, job: dict) -> None:
        try:
            self._log(f"ELMA Flasher v{APP_VERSION}")
            self._log(f"Target port: {port}")
            if job["mode"] == "clone":
                family, parts, configuration = self._prepare_clone(job)
            else:
                family, parts, configuration = self._prepare_file(job)
            self._emit("firmware_family", family)
            self._log(f"Image target: {CHIP_FAMILIES[family]}")
            overrides = job.get("preconfiguration", {})
            if overrides:
                configuration = merge_configuration(configuration or {}, overrides)
                self._log("Optional target preconfiguration will be applied after flashing.")
            requested_family = str(job.get("chip_choice", "auto"))
            if requested_family != "auto" and requested_family != family:
                raise RuntimeError(
                    f"Manual target selection {CHIP_FAMILIES.get(requested_family, requested_family)} is incompatible with "
                    f"this {CHIP_FAMILIES[family]} firmware. Choose Auto-detect or {CHIP_FAMILIES[family]}."
                )
            self._emit("status", 14, "Detecting target chip", f"Checking the ESP connected on {port} before any erase or write.", ORANGE)
            try:
                detected_family, detected_flash_size = self._detect_target_chip(port)
                self._emit("chip_detected", detected_family, detected_flash_size)
            except BaseException:
                if requested_family == "auto":
                    raise
                detected_family = requested_family
                detected_flash_size = ""
                self._log(f"Automatic detection unavailable; using manual {CHIP_FAMILIES[requested_family]} override. Espressif's loader will still verify the chip before writing.")
            if detected_family != family:
                detected_label = KNOWN_CHIP_MODELS.get(detected_family, detected_family.upper())
                flash_detail = f" with {detected_flash_size} flash" if detected_flash_size else ""
                raise RuntimeError(
                    f"Connected target reports {detected_label}{flash_detail}, but the selected firmware is compiled for {CHIP_FAMILIES[family]}. "
                    "Flash capacity does not make different ESP chip architectures compatible. Nothing was erased or written."
                )
            self._write_flash(port, family, parts, bool(job["erase"]))
            if configuration is not None:
                wifi = configuration.get("wifi", {}) if isinstance(configuration, dict) else {}
                expect_wifi_ip = isinstance(wifi, dict) and bool(str(wifi.get("ssid", "")).strip())
                ip_address = self._provision(port, configuration, expect_wifi_ip)
                operation = "Clone" if job["mode"] == "clone" else "Flash and configuration"
                detail = f"The target connected using its own hardware identity at {ip_address}." if ip_address else "Configuration saved; the target retained its own hardware identity."
                message = f"{operation} completed successfully."
                if ip_address:
                    message += f"\n\nNew device IP: {ip_address}"
                self._emit("status", 100, f"{operation} complete", detail, GREEN)
                self._emit("complete", ip_address, message)
            else:
                self._emit("status", 100, "Flash complete", "Firmware was written, verified and the target was reset.", GREEN)
                self._emit("complete", "", "Firmware flash completed successfully.")
        except BaseException as error:
            message = friendly_error(error)
            self._log(f"ERROR: {message}")
            self._emit("status", self.progress, "Flashing failed", message, RED)
            self._emit("error", message)

    def open_target(self) -> None:
        if self.last_ip:
            webbrowser.open(f"http://{self.last_ip}/")

    def open_designer(self) -> None:
        """Switch to the bundled native Designer view without launching a browser."""
        try:
            url = self.designer_server.start()
            self._log("Opening the bundled ELMA Device Designer window")
            self.root.withdraw()
            run_native_designer_window(url, self.window_icon_path)
        except BaseException as error:
            messagebox.showerror("ELMA Device Designer", friendly_error(error))
        finally:
            self.root.deiconify()
            self.root.lift()
            self.root.focus_force()

    def close(self) -> None:
        self.designer_server.stop()
        self.root.destroy()


def self_test() -> int:
    required = [
        resource_path("assets/ELMA-Flasher.ico"),
        resource_path("assets/esp32/bootloader.bin"),
        resource_path("assets/esp32/partitions.bin"),
        resource_path("assets/esp32s3/bootloader.bin"),
        resource_path("assets/esp32s3/partitions.bin"),
        resource_path("assets/esp32c3/bootloader.bin"),
        resource_path("assets/esp32c3/partitions.bin"),
    ]
    if getattr(sys, "frozen", False):
        required.extend([
            resource_path("ELMA-Compiler-Core.exe"),
            resource_path("web/index.html"),
            resource_path("web/modules/local-builder.js"),
            resource_path("builder_project/platformio.ini"),
            resource_path("builder_project/src/generated_web_assets.cpp"),
        ])
    missing = [str(path) for path in required if not path.is_file() or path.stat().st_size == 0]
    if missing:
        return 2
    if not getattr(esptool, "main", None) or not getattr(serial, "Serial", None):
        return 3
    esp32_header = bytearray(24)
    esp32_header[0] = 0xE9
    esp32s3_header = bytearray(esp32_header)
    esp32s3_header[12] = 0x09
    esp32c3_header = bytearray(esp32_header)
    esp32c3_header[12] = 0x05
    if chip_family_from_image(esp32_header) != "esp32" or chip_family_from_image(esp32s3_header) != "esp32s3" or chip_family_from_image(esp32c3_header) != "esp32c3":
        return 5
    if chip_family_from_esptool_output("Chip is ESP32-S3") != "esp32s3" or chip_family_from_esptool_output("Chip is ESP32") != "esp32":
        return 5
    c3_output = "Chip type: ESP32-C3 (revision v0.4)\nFeatures: Wi-Fi, Embedded Flash 4MB (XMC)"
    if chip_family_from_esptool_output(c3_output) != "esp32c3" or flash_size_from_esptool_output(c3_output) != "4 MB":
        return 5
    clone = sanitize_clone_configuration({
        "device": {"deviceName": "source", "friendlyName": "Source"},
        "mqtt": {"host": "broker", "clientId": "source", "baseTopic": "source/topic"},
        "wifi": {"ssid": "mesh", "useStaticIp": True, "staticIp": "192.168.1.40"},
    })
    overrides = FlasherApplication._preconfiguration_overrides({
        "friendly_name": "Kitchen", "wifi_ssid": "mesh", "wifi_password": "secret", "use_static_ip": True,
        "static_ip": "192.168.1.42", "gateway": "192.168.1.1", "subnet": "255.255.255.0", "dns1": "", "dns2": "",
        "mqtt_host": "broker", "mqtt_port": "1883", "mqtt_username": "", "mqtt_password": "", "mqtt_discovery": "enabled",
        "ap_ssid": "ELMA-Setup", "ap_password": "12345678", "ap_fallback": "enabled",
        "web_auth": "default", "web_username": "", "web_password": "",
    })
    configured = merge_configuration(clone, overrides)
    if configured["device"].get("friendlyName") != "Kitchen" or "deviceName" in configured["device"]:
        return 6
    if configured["wifi"].get("staticIp") != "192.168.1.42" or "clientId" in configured["mqtt"] or "baseTopic" in configured["mqtt"]:
        return 6
    return 0


def main() -> int:
    configure_windows_identity()
    if "--designer-only" in sys.argv:
        server = DesignerServer(None)  # Native flash is unavailable only in this test/server mode.
        print(server.start(), flush=True)
        try:
            assert server.httpd is not None
            server.thread.join()
        except KeyboardInterrupt:
            server.httpd.shutdown()
        return 0
    if "--self-test" in sys.argv:
        return self_test()
    if "--ui-smoke-test" in sys.argv:
        result = self_test()
        if result:
            return result
        root = tk.Tk()
        root.attributes("-alpha", 0.0)
        app = FlasherApplication(root, auto_detect_chip=False)
        root.update()
        button_bottom = app.flash_button.winfo_rooty() + app.flash_button.winfo_height()
        window_bottom = root.winfo_rooty() + root.winfo_height()
        icon_ok = app.window_icon_path.is_file() and app.window_icon_applied and window_has_windows_icon(root)
        app._set_selected_image_family("esp32")
        compatibility_ok = self_test() == 0 and app.chip_menu.entrycget(1, "state") == "normal" and app.chip_menu.entrycget(2, "state") == "disabled" and app.chip_menu.entrycget(3, "state") == "disabled"
        designer_ok = False
        try:
            designer_url = app.designer_server.start()
            with urllib.request.urlopen(f"{designer_url}api/builder/status", timeout=3) as response:
                designer_status = json.loads(response.read().decode("utf-8"))
            designer_ok = designer_status.get("active") is True and designer_status.get("version") == APP_VERSION
        finally:
            app.designer_server.stop()
        layout_ok = app.flash_button.winfo_ismapped() and button_bottom <= window_bottom
        root.destroy()
        return 0 if layout_ok and icon_ok and compatibility_ok and designer_ok else 4
    if "--native-designer-smoke-test" in sys.argv:
        result = self_test()
        if result:
            return result
        root = tk.Tk()
        root.withdraw()
        app = FlasherApplication(root, auto_detect_chip=False)
        root.withdraw()
        try:
            designer_url = app.designer_server.start()
            native_designer_ok = run_native_designer_window(designer_url, app.window_icon_path, smoke_test=True)
        finally:
            app.designer_server.stop()
            root.destroy()
        return 0 if native_designer_ok else 7
    root = tk.Tk()
    FlasherApplication(root)
    root.mainloop()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
