"""ELMA Flasher: standalone ESP32/ESP32-S3 firmware and clone utility."""

from __future__ import annotations

import base64
import binascii
import contextlib
import io
import json
import os
import pathlib
import queue
import re
import sys
import tempfile
import threading
import time
import tkinter as tk
import urllib.error
import urllib.parse
import urllib.request
import webbrowser
from tkinter import filedialog, messagebox, ttk

import esptool
import serial
from serial.tools import list_ports


APP_VERSION = "0.1.29"
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


def resource_path(relative: str) -> pathlib.Path:
    base = pathlib.Path(getattr(sys, "_MEIPASS", pathlib.Path(__file__).resolve().parent))
    return base / relative


def chip_family_from_image(data: bytes) -> str:
    if len(data) < 24 or data[0] != 0xE9:
        raise ValueError("The selected file is not a valid ESP32 application image.")
    chip_id = data[12] | (data[13] << 8)
    if chip_id == 0x0000:
        return "esp32"
    if chip_id == 0x0009:
        return "esp32s3"
    raise ValueError(f"Unsupported Espressif image chip ID 0x{chip_id:04X}.")


def crc32(data: bytes) -> int:
    return binascii.crc32(data) & 0xFFFFFFFF


def sanitize_clone_configuration(settings: object) -> dict:
    if not isinstance(settings, dict):
        raise ValueError("Source device returned an invalid configuration object.")
    cloned = json.loads(json.dumps(settings))
    device = cloned.setdefault("device", {})
    mqtt = cloned.setdefault("mqtt", {})
    if isinstance(device, dict):
        device.pop("deviceName", None)
        device.pop("friendlyName", None)
    if isinstance(mqtt, dict):
        mqtt.pop("clientId", None)
        mqtt.pop("baseTopic", None)
    cloned.pop("usingSavedSettings", None)
    return cloned


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


class FlasherApplication:
    def __init__(self, root: tk.Tk) -> None:
        self.root = root
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
        self.status = tk.StringVar(value="Ready to flash another ESP device")
        self.detail = tk.StringVar(value="Connect the target using a USB data cable, then select its COM port.")
        self.progress = 0
        self._configure_window()
        self._build_ui()
        self.refresh_ports()
        self.root.after(80, self._process_events)

    def _configure_window(self) -> None:
        self.root.title(f"ELMA Flasher v{APP_VERSION}")
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
        tk.Label(titles, text="Portable ESP32 / ESP32-S3 cloning and firmware utility", bg=DARK, fg="#d9d5ce", font=("Segoe UI", 10)).pack(anchor="w")
        tk.Label(header, text=f"v{APP_VERSION}", bg=ORANGE, fg=WHITE, font=("Segoe UI", 10, "bold"), padx=12, pady=6).pack(side="right", padx=24)

        # Reserve the primary action before the expanding body so Windows display
        # scaling can never push the Flash button below the visible client area.
        footer = tk.Frame(self.root, bg=PAPER)
        footer.pack(side="bottom", fill="x", padx=22, pady=(0, 16))
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
        options.columnconfigure(1, weight=1)
        options.columnconfigure(3, weight=1)

        target = tk.Frame(body, bg=PAPER)
        target.pack(fill="x", pady=14)
        port_card = tk.LabelFrame(target, text=" Target USB device ", bg=WHITE, fg=DARK, font=("Segoe UI", 11, "bold"), bd=1, relief="solid", padx=12, pady=10)
        port_card.pack(side="left", fill="both", expand=True, padx=(0, 7))
        self.port_combo = ttk.Combobox(port_card, textvariable=self.port, state="readonly", font=("Segoe UI", 10))
        self.port_combo.pack(side="left", fill="x", expand=True)
        tk.Button(port_card, text="Refresh", command=self.refresh_ports, bg="#eceae5", fg=DARK, relief="solid", bd=1, padx=12, pady=6).pack(side="left", padx=(8, 0))

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

    def choose_file(self) -> None:
        value = filedialog.askopenfilename(title="Select ELMA firmware", filetypes=[("ESP32 firmware", "*.bin"), ("All files", "*.*")])
        if value:
            self.firmware_file.set(value)

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
        if not labels:
            self.port.set("")
            self._set_status(0, "No USB serial device detected", "Connect the ESP with a data-capable USB cable, allow Windows to install its driver, then press Refresh.", RED)

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
        port = self.port.get().split(" — ", 1)[0].strip()
        if not port:
            messagebox.showerror("ELMA Flasher", "Select a connected USB serial device.")
            return
        if self.mode.get() == "file" and not self.firmware_file.get().strip():
            messagebox.showerror("ELMA Flasher", "Select an ESP32 application .bin file.")
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
        if family not in ("esp32", "esp32s3"):
            raise RuntimeError(f"Source device reported unsupported chip family {family or 'unknown'}.")
        parts: list[tuple[int, bytes]] = []
        source_parts = manifest.get("parts")
        if not isinstance(source_parts, list):
            raise RuntimeError("Source firmware clone manifest does not contain flash parts. Install the corrected v0.1.29 firmware first.")
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
        bootloader_address = 0x0000 if family == "esp32s3" else 0x1000
        asset_base = resource_path(f"assets/{family}")
        bootloader = (asset_base / "bootloader.bin").read_bytes()
        partitions = (asset_base / "partitions.bin").read_bytes()
        return family, [(bootloader_address, bootloader), (0x8000, partitions), (APPLICATION_ADDRESS, application)], None

    def _esptool(self, arguments: list[str]) -> None:
        bridge = EsptoolOutput(self._handle_esptool_line)
        try:
            with contextlib.redirect_stdout(bridge), contextlib.redirect_stderr(bridge):
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

    def _provision(self, port: str, configuration: dict) -> str:
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
            self._log(f"Image target: {family}")
            self._write_flash(port, family, parts, bool(job["erase"]))
            if configuration is not None:
                ip_address = self._provision(port, configuration)
                self._emit("status", 100, "Clone complete", f"The target connected using its own hardware identity at {ip_address}.", GREEN)
                self._emit("complete", ip_address, f"Clone completed successfully.\n\nNew device IP: {ip_address}")
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


def self_test() -> int:
    required = [
        resource_path("assets/esp32/bootloader.bin"),
        resource_path("assets/esp32/partitions.bin"),
        resource_path("assets/esp32s3/bootloader.bin"),
        resource_path("assets/esp32s3/partitions.bin"),
    ]
    missing = [str(path) for path in required if not path.is_file() or path.stat().st_size == 0]
    if missing:
        return 2
    if not getattr(esptool, "main", None) or not getattr(serial, "Serial", None):
        return 3
    return 0


def main() -> int:
    if "--self-test" in sys.argv:
        return self_test()
    if "--ui-smoke-test" in sys.argv:
        result = self_test()
        if result:
            return result
        root = tk.Tk()
        root.attributes("-alpha", 0.0)
        app = FlasherApplication(root)
        root.update()
        button_bottom = app.flash_button.winfo_rooty() + app.flash_button.winfo_height()
        window_bottom = root.winfo_rooty() + root.winfo_height()
        layout_ok = app.flash_button.winfo_ismapped() and button_bottom <= window_bottom
        root.destroy()
        return 0 if layout_ok else 4
    root = tk.Tk()
    FlasherApplication(root)
    root.mainloop()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
