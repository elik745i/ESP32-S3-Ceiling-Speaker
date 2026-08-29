export function createLocalBuilder({ elements, currentSettingsSnapshot, setMessage, toast }) {
  let active = false;
  let jobId = "";
  let timer = null;

  function formatBytes(value) {
    const bytes = Number(value || 0);
    if (!bytes) return "Pending firmware build";
    return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(2)} MiB` : `${Math.round(bytes / 1024)} KiB`;
  }

  function renderBuildEstimate(build = {}) {
    const set = (id, value) => {
      const target = document.getElementById(id);
      if (target) target.textContent = value;
    };
    const application = Number(build.applicationBytes || 0);
    const capacity = Number(build.flashCapacityBytes || 0);
    const ramUsed = Number(build.ramUsedBytes || 0);
    const ramTotal = Number(build.ramTotalBytes || 0);
    set("pcBuildProfile", build.profile || "Resolved after USB chip detection");
    set("pcBuildFlash", application
      ? `${formatBytes(application)} confirmed${capacity ? ` · ${(application / capacity * 100).toFixed(1)}% of ${formatBytes(capacity)} chip flash` : ""}`
      : "Estimated during compile; confirmed from firmware.bin");
    set("pcBuildRam", ramUsed
      ? `${formatBytes(ramUsed)} linked static use · ${(ramUsed / ramTotal * 100).toFixed(1)}% of ${formatBytes(ramTotal)}`
      : "Estimated during compile; confirmed from linker report");
    set("pcBuildFile", build.firmwareFile || "Generated binary will be saved beside ELMA Flasher");
  }

  function adaptInterfaceForPc(version = "") {
    document.title = "ELMA Flasher — Device Designer";
    document.querySelector(".hero-actions")?.setAttribute("hidden", "");
    const title = document.getElementById("deviceTitle");
    if (title) title.textContent = "ELMA Device Designer";
    const firmwareLabel = document.querySelector(".hero-firmware-label");
    if (firmwareLabel) firmwareLabel.textContent = "ELMA Flasher";

    const hideTab = (name) => {
      document.querySelector(`.tab-button[data-tab="${name}"]`)?.setAttribute("hidden", "");
      document.getElementById(`tab-${name}`)?.setAttribute("hidden", "");
    };
    ["motor", "playback", "effects", "battery", "storage-internal", "storage-external"].forEach(hideTab);
    document.getElementById("motorHeroStat")?.setAttribute("hidden", "");

    const deviceTab = document.querySelector('.tab-button[data-tab="device"]');
    if (deviceTab) {
      deviceTab.setAttribute("aria-label", "Identity & Startup");
      deviceTab.setAttribute("data-tooltip", "Identity & Startup");
      deviceTab.title = "Identity & Startup";
    }
    const deviceHeading = document.querySelector("#tab-device > h2");
    if (deviceHeading) deviceHeading.textContent = "Identity & Startup";
    document.querySelector("#tab-device .device-summary-grid")?.setAttribute("hidden", "");
    document.querySelector('[name="device.savedVolumePercent"]')?.closest("label")?.setAttribute("hidden", "");
    ["lowBatterySleepToggle", "powerCycleFactoryResetToggle", "touchHoldFactoryResetToggle", "lowBatterySleepThreshold", "lowBatteryWakeIntervalMinutes"].forEach((id) => {
      document.getElementById(id)?.closest("label")?.setAttribute("hidden", "");
    });
    document.getElementById("factoryResetButton")?.setAttribute("hidden", "");
    document.getElementById("mqttRediscoveryButton")?.closest(".inline-actions")?.setAttribute("hidden", "");

    const hardwareTab = document.querySelector('.tab-button[data-tab="hardware"]');
    if (hardwareTab) {
      hardwareTab.setAttribute("aria-label", "Build Memory Estimate");
      hardwareTab.setAttribute("data-tooltip", "Build Memory Estimate");
      hardwareTab.title = "Build Memory Estimate";
    }
    const hardware = document.getElementById("tab-hardware");
    if (hardware) {
      hardware.innerHTML = `
        <h2>Build Memory Estimate</h2>
        <p class="note">Values are estimates until compilation finishes. ELMA Flasher then replaces them with the exact application binary size and the compiler linker's static RAM report.</p>
        <div class="status-list">
          <div class="status-item"><span>Build profile</span><strong id="pcBuildProfile">Resolved after USB chip detection</strong></div>
          <div class="status-item"><span>Application flash</span><strong id="pcBuildFlash">Estimated during compile</strong></div>
          <div class="status-item"><span>Static RAM</span><strong id="pcBuildRam">Estimated during compile</strong></div>
          <div class="status-item"><span>Saved binary</span><strong id="pcBuildFile">Generated beside ELMA Flasher</strong></div>
        </div>
        <p class="note">Runtime heap and stack peaks depend on the configured peripherals and traffic; confirm those after flashing from the real device's Hardware Monitor.</p>`;
      renderBuildEstimate();
    }

    const wifiNote = document.querySelector("#tab-wifi .note");
    if (wifiNote) wifiNote.textContent = "Scan uses this PC's Wi-Fi adapter. Connect temporarily tests the selected SSID and password through Windows, then saves verified credentials into the future firmware configuration. If no PC Wi-Fi adapter is available, the application reports that directly.";

    const info = document.getElementById("tab-info");
    if (info) {
      info.innerHTML = `
        <h2>About ELMA Flasher</h2>
        <div class="status-list">
          <div class="status-item"><span>Application</span><strong>ELMA Flasher ${version ? `v${version}` : ""}</strong></div>
          <div class="status-item"><span>Purpose</span><strong>Design, compile, provision and flash ELMA ESP devices from a PC</strong></div>
          <div class="status-item"><span>Supported targets</span><strong>ESP32, ESP32-S3 and ESP32-C3</strong></div>
          <div class="status-item"><span>Identity safety</span><strong>Device and MQTT identity are regenerated from the target hardware ID</strong></div>
        </div>
        <h3>Capabilities</h3>
        <p>Configure GPIO wiring, peripherals, Wi-Fi, MQTT, AP fallback, identity, web access and firmware features. The embedded compiler selects the maximum compatible feature set for the chosen chip, then writes and verifies the connected USB target without browser HTTPS or Web Serial requirements.</p>
        <p><a class="button-link" href="https://github.com/elma-iot/ELMA-IoT">Open the ELMA IoT project on GitHub</a></p>
        <p class="note">This screen describes the PC application. Runtime health, storage, media playback, reboot, shutdown and factory-reset controls appear only in the web interface of a flashed device.</p>`;
    }
  }

  async function api(path, options = {}) {
    const response = await fetch(path, {
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      ...options,
    });
    let payload = {};
    try { payload = await response.json(); } catch {}
    if (!response.ok) throw new Error(payload.error || `Builder HTTP ${response.status}`);
    return payload;
  }

  function setProgress(percent, label) {
    const value = Math.max(0, Math.min(100, Number(percent || 0)));
    elements.localBuilderProgressFill.style.width = `${value}%`;
    elements.localBuilderProgressLabel.textContent = label || "Working...";
  }

  function setBusy(busy) {
    elements.localBuilderCompileFlash.disabled = busy;
    elements.localBuilderRefreshPorts.disabled = busy;
    elements.localBuilderCancel.hidden = !busy;
  }

  async function refreshPorts() {
    const payload = await api("/api/builder/ports");
    const previous = elements.localBuilderPort.value;
    elements.localBuilderPort.innerHTML = "";
    for (const port of payload.ports || []) {
      const option = document.createElement("option");
      option.value = port.device;
      option.textContent = `${port.device} — ${port.description || "Serial device"}`;
      elements.localBuilderPort.appendChild(option);
    }
    if (previous && [...elements.localBuilderPort.options].some((item) => item.value === previous)) {
      elements.localBuilderPort.value = previous;
    }
    if (!elements.localBuilderPort.options.length) {
      elements.localBuilderPort.appendChild(new Option("No USB serial device detected", ""));
    }
  }

  function applyTargetPolicy() {
    const chip = elements.localBuilderChip.value;
    const c3 = chip === "esp32c3";
    const maximum = elements.localBuilderMaximum.checked;
    elements.localBuilderWebUi.disabled = maximum;
    elements.localBuilderHacs.disabled = maximum;
    elements.localBuilderAudio.disabled = maximum || c3;
    if (maximum) {
      elements.localBuilderWebUi.checked = true;
      elements.localBuilderHacs.checked = true;
      elements.localBuilderAudio.checked = !c3;
    } else if (c3) {
      elements.localBuilderAudio.checked = false;
    }
    const board = document.getElementById("gpioBoardSelector");
    if (board && chip !== "auto") {
      for (const option of board.options) {
        const value = option.value.toLowerCase();
        option.disabled = chip === "esp32c3" ? !value.includes("c3")
          : chip === "esp32s3" ? !value.includes("s3")
          : (value.includes("s3") || value.includes("c3") || value.includes("c6") || value.includes("s2"));
      }
      const usable = [...board.options].find((option) => !option.disabled);
      if (board.selectedOptions[0]?.disabled && usable) {
        board.value = usable.value;
        board.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
    elements.localBuilderCompatibility.textContent = c3
      ? "ESP32-C3 keeps the compatible web configurator, Wi-Fi, MQTT/HACS, OTA, GPIO/motor, displays, sensors, controls, storage and communications. Audio-only choices are unavailable."
      : "Maximum-fit mode retains every compatible feature that fits the detected chip and flash. Nothing is removed silently.";
  }

  async function poll() {
    if (!jobId) return;
    try {
      const state = await api(`/api/builder/jobs/${encodeURIComponent(jobId)}`);
      renderBuildEstimate(state);
      setProgress(state.progress, state.status);
      elements.localBuilderLog.textContent = (state.log || []).join("\n") || "Preparing build...";
      elements.localBuilderLog.scrollTop = elements.localBuilderLog.scrollHeight;
      elements.localBuilderCompatibility.textContent = state.compatibility || elements.localBuilderCompatibility.textContent;
      if (state.state === "complete") {
        setBusy(false);
        jobId = "";
        setMessage(state.ipAddress
          ? `Device flashed at ${state.ipAddress}. Firmware saved as ${state.firmwareFile || "a standard release binary"}.`
          : `Device compiled, flashed and configured successfully. Firmware saved as ${state.firmwareFile || "a standard release binary"}.`);
        toast("Compile and flash complete");
        return;
      }
      if (state.state === "failed" || state.state === "cancelled") {
        setBusy(false);
        jobId = "";
        setMessage(state.error || state.status, state.state === "failed");
        return;
      }
    } catch (error) {
      setBusy(false);
      jobId = "";
      setMessage(error.message, true);
      return;
    }
    timer = window.setTimeout(poll, 750);
  }

  async function compileAndFlash() {
    const port = elements.localBuilderPort.value;
    if (!port) throw new Error("Connect and select a USB ESP device first.");
    // The standalone Flash tab deliberately reads the shared Designer backend
    // at click time so a second WebEngine view cannot flash a stale snapshot.
    const desktopFlashView = new URLSearchParams(window.location.search).get("elmaView") === "flash";
    const settings = desktopFlashView ? await api("/api/settings") : currentSettingsSnapshot();
    const payload = {
      port,
      chip: elements.localBuilderChip.value,
      erase: elements.localBuilderErase.checked,
      settings,
      capabilities: {
        maximum: elements.localBuilderMaximum.checked,
        webUi: elements.localBuilderWebUi.checked,
        hacs: elements.localBuilderHacs.checked,
        audio: elements.localBuilderAudio.checked,
      },
    };
    const response = await api("/api/builder/jobs", { method: "POST", body: JSON.stringify(payload) });
    jobId = response.jobId;
    setBusy(true);
    setProgress(1, "Build queued");
    poll();
  }

  async function cancel() {
    if (!jobId) return;
    await api(`/api/builder/jobs/${encodeURIComponent(jobId)}/cancel`, { method: "POST", body: "{}" });
  }

  async function initialize() {
    try {
      const status = await api("/api/builder/status");
      active = Boolean(status.active);
    } catch {
      return;
    }
    if (!active) return;
    document.body.classList.add("local-builder-mode");
    adaptInterfaceForPc(status.version || "");
    elements.localBuilderPanel.hidden = false;
    if (elements.runtimeFirmwarePanel) elements.runtimeFirmwarePanel.hidden = true;
    elements.localBuilderBadge.textContent = `Local compiler ${status.version || ""}`.trim();
    if (new URLSearchParams(window.location.search).get("elmaView") === "flash") {
      const heading = elements.localBuilderPanel.querySelector(".local-builder-heading h3");
      const copy = elements.localBuilderPanel.querySelector(".local-builder-heading p");
      if (heading) heading.textContent = "Flash USB Device";
      if (copy) copy.textContent = "Uses the complete configuration saved in Device Designer. Select the connected target, then compile and flash.";
    }
    await refreshPorts();
    elements.localBuilderRefreshPorts.addEventListener("click", () => refreshPorts().catch((error) => setMessage(error.message, true)));
    elements.localBuilderChip.addEventListener("change", applyTargetPolicy);
    elements.localBuilderMaximum.addEventListener("change", applyTargetPolicy);
    elements.localBuilderCompileFlash.addEventListener("click", () => compileAndFlash().catch((error) => setMessage(error.message, true)));
    elements.localBuilderCancel.addEventListener("click", () => cancel().catch((error) => setMessage(error.message, true)));
    applyTargetPolicy();
  }

  return { initialize, refreshPorts };
}
