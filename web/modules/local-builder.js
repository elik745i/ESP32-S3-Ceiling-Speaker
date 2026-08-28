export function createLocalBuilder({ elements, currentSettingsSnapshot, setMessage, toast }) {
  let active = false;
  let jobId = "";
  let timer = null;

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
      setProgress(state.progress, state.status);
      elements.localBuilderLog.textContent = (state.log || []).join("\n") || "Preparing build...";
      elements.localBuilderLog.scrollTop = elements.localBuilderLog.scrollHeight;
      elements.localBuilderCompatibility.textContent = state.compatibility || elements.localBuilderCompatibility.textContent;
      if (state.state === "complete") {
        setBusy(false);
        jobId = "";
        setMessage(state.ipAddress ? `Device flashed at ${state.ipAddress}` : "Device compiled, flashed and configured successfully.");
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
    const settings = currentSettingsSnapshot();
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
    elements.localBuilderPanel.hidden = false;
    if (elements.runtimeFirmwarePanel) elements.runtimeFirmwarePanel.hidden = true;
    elements.localBuilderBadge.textContent = `Local compiler ${status.version || ""}`.trim();
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
