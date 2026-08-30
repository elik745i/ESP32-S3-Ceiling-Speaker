export function normalizeWifiPower(value) {
  const number = value === "" || value == null ? NaN : Number(value);
  return Number.isFinite(number) ? Math.max(2, Math.min(19.5, Math.round(number * 2) / 2)) : 15;
}

export function wifiPowerStatusText(network, designer = false) {
  if (designer) return "Future ESP device settings — these sliders do not change this PC's Wi-Fi adapter.";
  if (!network?.txPowerAvailable) return "Active radio limit unavailable (requires firmware v0.1.41 or newer).";
  const error = Number(network.txPowerApplyError || 0);
  return `${network.txPowerMode || "Wi-Fi"} · driver-reported limit: ${Number(network.txPowerDbm)} dBm${error ? ` · apply error ${error}` : ""}`;
}

export function renderWifiPowerValues(root = document) {
  for (const mode of ["sta", "ap"]) {
    const input = root.querySelector(`[name="wifi.${mode}TxPowerDbm"]`);
    const output = root.getElementById(`wifi${mode.toUpperCase()}PowerValue`);
    if (!input) continue;
    const value = normalizeWifiPower(input.value);
    if (output) output.textContent = `${value} dBm`;
    input.style.setProperty("--wifi-power-fill", `${(value - 2) / 17.5 * 100}%`);
    input.setAttribute("aria-valuetext", `${value} dBm requested transmit-power limit`);
  }
}

export function createWifiPowerControls({ state, request, saveSettings, waitForSettingsIdle, setMessage, handleError }) {
  let saving = false;
  const designer = () => document.body.classList.contains("local-builder-mode");
  const button = () => document.getElementById("wifiApplyPowerButton");
  function renderStatus(status = state.status) {
    renderWifiPowerValues();
    const label = document.getElementById("wifiPowerStatus");
    if (label) label.textContent = wifiPowerStatusText(status?.network, designer());
    if (button()) button().disabled = saving || (!designer() && !status?.network?.txPowerAvailable);
  }
  async function apply() {
    if (saving) return;
    const wifi = {};
    for (const mode of ["sta", "ap"]) {
      wifi[`${mode}TxPowerDbm`] = normalizeWifiPower(document.querySelector(`[name="wifi.${mode}TxPowerDbm"]`)?.value);
    }
    saving = true;
    renderStatus();
    try {
      await waitForSettingsIdle();
      if (designer()) {
        // The desktop settings endpoint replaces its document: always use the
        // shared full-document save, never submit a two-field partial document.
        await saveSettings({ silent: true });
        setMessage("STA/AP transmit-power settings saved for firmware configuration and USB provisioning.");
        return;
      }
      // Preserve unsubmitted SSID/password/IP edits and all other subsystems.
      await request("/api/settings", { method: "POST", body: JSON.stringify({ wifi }) });
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const status = await request("/api/status");
        const network = status.network || {};
        if (network.staTxPowerDbm === wifi.staTxPowerDbm && network.apTxPowerDbm === wifi.apTxPowerDbm) {
          state.settings ||= {};
          state.settings.wifi = { ...state.settings.wifi, ...wifi };
          state.status = status;
          renderStatus(status);
          if (Number(network.txPowerApplyError || 0)) throw new Error(`Settings saved, but the radio rejected the power request (${network.txPowerApplyError}).`);
          setMessage(`Wi-Fi power saved and applied. ${wifiPowerStatusText(network)}`);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      throw new Error("Power settings were saved; radio confirmation is still pending. Check the active limit before leaving this page.");
    } finally {
      saving = false;
      renderStatus();
    }
  }
  function bindEvents() {
    for (const input of document.querySelectorAll("[data-wifi-power]")) {
      input.addEventListener("input", () => {
        state.settingsDirty = true;
        state.settingsEditRevision = Number(state.settingsEditRevision || 0) + 1;
        renderWifiPowerValues();
      });
    }
    button()?.addEventListener("click", () => apply().catch(handleError));
    renderStatus();
  }
  return { bindEvents, renderStatus, apply };
}
