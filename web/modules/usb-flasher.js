const ESPTOOL_MODULE_URL = "https://unpkg.com/esptool-js@0.6.1/lib/index.js";
const SPARK_MD5_MODULE_URL = "https://cdn.jsdelivr.net/npm/spark-md5@3.0.2/+esm";
const FLASH_BAUD_RATE = 460800;
const CONSOLE_BAUD_RATE = 115200;
const OTA_DATA_ADDRESS = 0xe000;
const OTA_DATA_SIZE = 0x2000;
const PROVISION_TIMEOUT_MS = 120000;
const RING_CIRCUMFERENCE = 2 * Math.PI * 52;

function delay(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function normalizedChipFamily(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function chipFamilyFromImage(image) {
  if (!(image instanceof Uint8Array) || image.length < 24 || image[0] !== 0xe9) {
    throw new Error("The selected file is not a valid ESP32 application image.");
  }
  const chipId = image[12] | (image[13] << 8);
  if (chipId === 0x0000) {
    return "esp32";
  }
  if (chipId === 0x0009) {
    return "esp32s3";
  }
  throw new Error(`The firmware declares unsupported Espressif chip ID 0x${chipId.toString(16).padStart(4, "0")}.`);
}

function crc32(data) {
  let crc = 0xffffffff;
  for (const value of data) {
    crc ^= value;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function safeCloneConfiguration(settings) {
  const cloned = JSON.parse(JSON.stringify(settings || {}));
  cloned.device ||= {};
  cloned.mqtt ||= {};
  delete cloned.device.deviceName;
  delete cloned.device.friendlyName;
  delete cloned.mqtt.clientId;
  delete cloned.mqtt.baseTopic;
  delete cloned.usingSavedSettings;
  return cloned;
}

function friendlyUsbError(error) {
  const name = String(error?.name || "");
  const message = String(error?.message || error || "Unknown USB flashing error.");
  if (name === "NotFoundError") {
    return "No USB serial device was selected. Connect the target with a data-capable cable and try again.";
  }
  if (name === "SecurityError") {
    return "The browser blocked serial access. Web Serial requires Chrome or Edge on an HTTPS/localhost page and an explicit device selection.";
  }
  if (name === "NetworkError" || /already open|failed to open|port is busy/i.test(message)) {
    return "The selected serial port is busy or unavailable. Close Arduino Serial Monitor, PlatformIO Monitor, and other flashing tools, then reconnect the device.";
  }
  if (/failed to connect|connect.*timed|sync|bootloader/i.test(message)) {
    return "Could not enter the ESP bootloader. Hold BOOT, tap RESET, release BOOT after connection starts, and try again.";
  }
  if (/disconnect|device has been lost|broken pipe/i.test(message)) {
    return "The USB device disconnected during flashing. Check the cable and power supply, reconnect it, and retry.";
  }
  return message;
}

async function fetchBinary(url, expectedSize, progress) {
  const response = await fetch(url, { cache: "no-store", credentials: "same-origin" });
  if (!response.ok) {
    let detail = "";
    try {
      detail = (await response.json())?.error || "";
    } catch {
    }
    throw new Error(detail || `Unable to download ${url} (HTTP ${response.status}).`);
  }

  if (!response.body) {
    const data = new Uint8Array(await response.arrayBuffer());
    progress?.(data.length, expectedSize || data.length);
    return data;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    chunks.push(value);
    received += value.length;
    progress?.(received, expectedSize || received);
  }
  if (expectedSize && received !== expectedSize) {
    throw new Error(`Firmware download was incomplete: received ${received} of ${expectedSize} bytes.`);
  }
  const data = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.length;
  }
  return data;
}

export function createUsbFlasher({ elements, request, setMessage }) {
  let busy = false;
  let activeTransport = null;

  function appendLog(value) {
    const text = String(value || "").replace(/\r/g, "").trimEnd();
    if (!text) {
      return;
    }
    const existing = String(elements.usbFlasherLog?.textContent || "");
    const lines = `${existing === "Waiting to start..." ? "" : existing}\n${text}`.trim().split("\n").slice(-80);
    elements.usbFlasherLog.textContent = lines.join("\n");
    elements.usbFlasherLog.scrollTop = elements.usbFlasherLog.scrollHeight;
  }

  function updateProgress(percent, status, detail = "", tone = "") {
    const value = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
    elements.usbFlasherProgressCircle.style.strokeDasharray = `${RING_CIRCUMFERENCE}`;
    elements.usbFlasherProgressCircle.style.strokeDashoffset = `${RING_CIRCUMFERENCE * (1 - value / 100)}`;
    elements.usbFlasherProgressCircle.classList.toggle("ok", tone === "ok");
    elements.usbFlasherProgressCircle.classList.toggle("error", tone === "error");
    elements.usbFlasherProgressValue.textContent = String(value);
    elements.usbFlasherStatus.textContent = status;
    elements.usbFlasherDetail.textContent = detail;
    elements.usbFlasherProgressCircle.closest("[role=progressbar]")?.setAttribute("aria-valuenow", String(value));
  }

  function setBusy(nextBusy) {
    busy = nextBusy;
    elements.usbFlasherStartButton.disabled = nextBusy || !isSupported();
    elements.usbFlasherCloseButton.disabled = nextBusy;
    elements.usbFlasherCancelButton.disabled = nextBusy;
    elements.usbFlasherOptions.disabled = nextBusy;
  }

  function isSupported() {
    return Boolean(window.isSecureContext && navigator.serial?.requestPort);
  }

  function updateCompatibility() {
    if (isSupported()) {
      elements.usbFlasherCompatibility.className = "usb-flasher-alert ok";
      elements.usbFlasherCompatibility.textContent = "Web Serial is ready. Chrome or Edge will show the operating system's USB-device picker before any flash access is granted.";
      elements.usbFlasherStartButton.disabled = busy;
      return;
    }
    elements.usbFlasherCompatibility.className = "usb-flasher-alert error";
    elements.usbFlasherCompatibility.textContent = window.isSecureContext
      ? "This browser does not provide Web Serial. Use a current desktop Chrome or Microsoft Edge browser."
      : `USB flashing is blocked on this HTTP page by browser security. On the PC, run scripts/usb_flasher_proxy.py ${window.location.hostname}, then use the localhost page it opens in Chrome or Edge.`;
    elements.usbFlasherStartButton.disabled = true;
  }

  function selectedMode() {
    return document.querySelector('input[name="usbFlasherMode"]:checked')?.value || "clone";
  }

  function eraseRequested() {
    return document.querySelector('input[name="usbFlasherErase"]:checked')?.value !== "no";
  }

  function updateModeUi() {
    const fileMode = selectedMode() === "file";
    elements.usbFlasherChooseFileButton.hidden = !fileMode;
    elements.usbFlasherFileLabel.hidden = !fileMode;
  }

  function resetUi() {
    elements.usbFlasherLog.textContent = "Waiting to start...";
    elements.usbFlasherTargetLink.hidden = true;
    elements.usbFlasherTargetLink.removeAttribute("href");
    elements.usbFlasherOpenTargetButton.hidden = true;
    elements.usbFlasherOpenTargetButton.removeAttribute("href");
    updateProgress(0, "Ready to select a USB device", "The browser will ask which serial device may be used.");
    updateModeUi();
    updateCompatibility();
  }

  function open() {
    resetUi();
    elements.usbFlasherDialog.showModal();
  }

  function close() {
    if (!busy) {
      elements.usbFlasherDialog.close();
    }
  }

  function exposeTargetIp(ipAddress) {
    const url = `http://${ipAddress}/`;
    elements.usbFlasherTargetLink.textContent = ipAddress;
    elements.usbFlasherTargetLink.href = url;
    elements.usbFlasherTargetLink.hidden = false;
    elements.usbFlasherOpenTargetButton.href = url;
    elements.usbFlasherOpenTargetButton.hidden = false;
  }

  async function loadFlashParts(manifest, localFile, onDownload) {
    const sourceParts = Array.isArray(manifest?.parts) ? manifest.parts : [];
    const required = ["bootloader", "partitions"];
    const parts = [];
    let downloaded = 0;
    const total = sourceParts
      .filter((part) => required.includes(part.name) || (!localFile && part.name === "application"))
      .reduce((sum, part) => sum + Number(part.size || 0), 0) + Number(localFile?.size || 0);

    for (const part of sourceParts) {
      if (!required.includes(part.name) && (localFile || part.name !== "application")) {
        continue;
      }
      const base = downloaded;
      const data = await fetchBinary(part.sourceUrl, Number(part.size || 0), (received) => {
        onDownload(total > 0 ? (base + received) / total : 0);
      });
      downloaded += data.length;
      parts.push({ name: part.name, data, address: Number(part.address) });
    }

    if (localFile) {
      const data = new Uint8Array(await localFile.arrayBuffer());
      if (data.length > 0x1f0000) {
        throw new Error("The selected application image is larger than the 0x1F0000-byte OTA slot.");
      }
      parts.push({ name: "application", data, address: 0x10000 });
      onDownload(1);
    }

    const otaReset = new Uint8Array(OTA_DATA_SIZE).fill(0xff);
    parts.splice(parts.length - 1, 0, { name: "ota-data-reset", data: otaReset, address: OTA_DATA_ADDRESS });
    return parts;
  }

  async function writeSerial(port, data) {
    const writer = port.writable.getWriter();
    try {
      await writer.write(data);
    } finally {
      writer.releaseLock();
    }
  }

  async function provisionCloneAndFindIp(port, configuration) {
    const encoder = new TextEncoder();
    const payload = encoder.encode(JSON.stringify(safeCloneConfiguration(configuration)));
    const checksum = crc32(payload).toString(16).padStart(8, "0").toUpperCase();
    const header = encoder.encode(`ELMA_CLONE_CONFIG ${payload.length} ${checksum}\n`);
    const deadline = Date.now() + PROVISION_TIMEOUT_MS;
    let configurationSent = false;
    let configurationApplied = false;
    let textBuffer = "";

    while (Date.now() < deadline) {
      try {
        if (!port.readable || !port.writable) {
          await port.open({ baudRate: CONSOLE_BAUD_RATE, bufferSize: 65536 });
        }
        await writeSerial(port, encoder.encode("ELMA_CLONE_PING\n"));
        const reader = port.readable.getReader();
        const sessionTimer = window.setTimeout(() => reader.cancel().catch(() => {}), 10000);
        try {
          while (Date.now() < deadline) {
            const { value, done } = await reader.read();
            if (done) {
              break;
            }
            textBuffer += new TextDecoder().decode(value, { stream: true });
            const lines = textBuffer.split(/\r?\n/);
            textBuffer = lines.pop() || "";
            for (const line of lines) {
              appendLog(line);
              if (!configurationSent && line.includes("[clone] provisioning ready")) {
                updateProgress(94, "Copying configuration", "Sending Wi-Fi, MQTT, GPIO, peripheral, and UI settings over USB.");
                await writeSerial(port, header);
                await writeSerial(port, payload);
                configurationSent = true;
              }
              if (line.includes("[clone] error=")) {
                throw new Error(line.substring(line.indexOf("error=") + 6));
              }
              if (line.includes("[clone] configuration applied")) {
                configurationApplied = true;
                updateProgress(97, "Configuration saved", "Target identity was regenerated; waiting for cloned Wi-Fi to connect.");
              }
              const ipMatch = line.match(/\[wifi\].*station connected.*\bip=(\d{1,3}(?:\.\d{1,3}){3})/i);
              if (configurationApplied && ipMatch) {
                return ipMatch[1];
              }
            }
          }
        } finally {
          window.clearTimeout(sessionTimer);
          reader.releaseLock();
        }
      } catch (error) {
        if (/checksum|invalid configuration|rejected/i.test(String(error?.message || error))) {
          throw error;
        }
        appendLog(`Serial reconnect: ${error?.message || error}`);
      }

      try {
        if (port.readable || port.writable) {
          await port.close();
        }
      } catch {
      }
      await delay(1000);
    }

    if (!configurationSent) {
      throw new Error("The new firmware booted, but the serial provisioning channel did not become ready.");
    }
    if (!configurationApplied) {
      throw new Error("The configuration transfer did not receive confirmation from the target device.");
    }
    throw new Error("Configuration was cloned, but the target did not report a Wi-Fi IP address within two minutes. Check Wi-Fi signal and credentials; the target may be available through its fallback access point.");
  }

  async function start() {
    if (busy || !isSupported()) {
      updateCompatibility();
      return;
    }

    const mode = selectedMode();
    const localFile = mode === "file" ? elements.usbFlasherFile.files?.[0] : null;
    if (mode === "file" && !localFile) {
      throw new Error("Choose a local ESP32 application .bin file first.");
    }
    if (localFile && (!/\.bin$/i.test(localFile.name) || localFile.size <= 0)) {
      throw new Error("Choose a non-empty .bin firmware image.");
    }

    let port = null;
    setBusy(true);
    elements.usbFlasherLog.textContent = "";
    updateProgress(2, "Select the target USB device", "Choose only the ESP device you intend to overwrite.");

    try {
      port = await navigator.serial.requestPort();
      updateProgress(5, "Loading flashing engine", "Downloading Espressif esptool-js over HTTPS.");
      const [{ ESPLoader, Transport }, md5Module] = await Promise.all([
        import(ESPTOOL_MODULE_URL),
        import(SPARK_MD5_MODULE_URL),
      ]);
      const SparkMD5 = md5Module.default || md5Module;

      updateProgress(8, "Connecting to bootloader", "Resetting and detecting the connected ESP chip.");
      const transport = new Transport(port, true);
      activeTransport = transport;
      const loader = new ESPLoader({
        transport,
        baudrate: FLASH_BAUD_RATE,
        debugLogging: false,
        terminal: {
          clean() {},
          writeLine: appendLog,
          write: appendLog,
        },
      });
      const detectedName = await loader.main();
      const detectedFamily = normalizedChipFamily(detectedName || loader.chip?.CHIP_NAME);
      appendLog(`Detected target: ${detectedName || loader.chip?.CHIP_NAME || "unknown"}`);

      const [manifest, configuration] = await Promise.all([
        request("/api/usb-flasher/manifest"),
        mode === "clone" ? request("/api/settings") : Promise.resolve(null),
      ]);
      const sourceFamily = normalizedChipFamily(manifest.chipFamily);
      if (detectedFamily !== sourceFamily) {
        throw new Error(`Chip-family mismatch: this device provides ${manifest.chipFamily} firmware, but the selected USB target is ${detectedName || "a different ESP family"}.`);
      }

      updateProgress(12, "Preparing firmware", mode === "clone" ? "Reading firmware safely from this device; identity storage is excluded." : `Reading ${localFile.name}.`);
      const parts = await loadFlashParts(manifest, localFile, (ratio) => {
        updateProgress(12 + ratio * 10, "Preparing firmware", `${Math.round(ratio * 100)}% downloaded`);
      });
      const application = parts.find((part) => part.name === "application")?.data;
      const imageFamily = chipFamilyFromImage(application);
      if (imageFamily !== detectedFamily) {
        throw new Error(`Firmware image targets ${imageFamily === "esp32s3" ? "ESP32-S3" : "ESP32"}, but the selected target is ${detectedName}.`);
      }

      const shouldErase = eraseRequested();
      updateProgress(24, shouldErase ? "Erasing target flash" : "Preparing target flash", shouldErase ? "A full erase may take several seconds." : "Existing NVS is preserved; OTA selection is reset to the first application slot.");
      const originalBytes = parts.reduce((sum, part) => sum + part.data.length, 0);
      const completedByFile = new Map();
      await loader.writeFlash({
        fileArray: parts.map((part) => ({ data: part.data, address: part.address })),
        flashMode: "keep",
        flashFreq: "keep",
        flashSize: "keep",
        eraseAll: shouldErase,
        compress: true,
        calculateMD5Hash(image) {
          const exact = image.buffer.slice(image.byteOffset, image.byteOffset + image.byteLength);
          return SparkMD5.ArrayBuffer.hash(exact);
        },
        reportProgress(fileIndex, written, total) {
          const part = parts[fileIndex];
          completedByFile.set(fileIndex, total > 0 ? Math.min(1, written / total) : 0);
          const weighted = parts.reduce((sum, candidate, index) => sum + candidate.data.length * (completedByFile.get(index) || 0), 0);
          const percent = 25 + (originalBytes > 0 ? (weighted / originalBytes) * 65 : 0);
          updateProgress(percent, `Flashing ${part?.name || "firmware"}`, `${written} / ${total} transfer bytes; flash hash will be verified.`);
        },
      });

      updateProgress(92, "Firmware verified", "Resetting the target into the new application.");
      await loader.after("hard_reset");
      await transport.disconnect();
      activeTransport = null;

      if (mode === "clone") {
        updateProgress(93, "Waiting for target firmware", "Opening the 115200-baud provisioning channel.");
        const ipAddress = await provisionCloneAndFindIp(port, configuration);
        exposeTargetIp(ipAddress);
        updateProgress(100, "Clone complete", `The target connected as its own hardware identity at ${ipAddress}.`, "ok");
        setMessage(`Cloned device is online at ${ipAddress}`);
      } else {
        updateProgress(100, "Flash complete", "The target was reset. Its existing configuration was preserved unless full erase was selected.", "ok");
        setMessage("USB firmware flash completed");
      }
    } catch (error) {
      const message = friendlyUsbError(error);
      appendLog(`ERROR: ${message}`);
      updateProgress(Number(elements.usbFlasherProgressValue.textContent || 0), "Flashing failed", message, "error");
      setMessage(message, true);
      throw error;
    } finally {
      if (activeTransport) {
        try {
          await activeTransport.disconnect();
        } catch {
        }
        activeTransport = null;
      }
      setBusy(false);
    }
  }

  elements.usbFlashAnotherDeviceButton?.addEventListener("click", open);
  elements.usbFlasherCloseButton?.addEventListener("click", close);
  elements.usbFlasherCancelButton?.addEventListener("click", close);
  elements.usbFlasherDialog?.addEventListener("cancel", (event) => {
    if (busy) {
      event.preventDefault();
    }
  });
  document.querySelectorAll('input[name="usbFlasherMode"]').forEach((input) => input.addEventListener("change", updateModeUi));
  elements.usbFlasherChooseFileButton?.addEventListener("click", () => elements.usbFlasherFile.click());
  elements.usbFlasherFile?.addEventListener("change", () => {
    const file = elements.usbFlasherFile.files?.[0];
    elements.usbFlasherFileLabel.textContent = file ? `${file.name} (${file.size} bytes)` : "No firmware file selected";
  });
  elements.usbFlasherStartButton?.addEventListener("click", () => start().catch((error) => console.error(error)));

  return { open, close, start, updateCompatibility };
}
