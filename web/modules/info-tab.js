export function createInfoTab({ elements, formatBytes, normalizePlaybackTitle }) {
  function renderStatus(status = {}) {
    const device = status?.device || {};
    const network = status?.network || {};
    const playback = status?.playback || {};
    const firmware = status?.firmware || {};
    const settings = status?.settings || {};
    const wifiConnected = Boolean(network.wifiConnected);
    const mqttConnected = Boolean(network.mqttConnected);
    const currentTitle = normalizePlaybackTitle(playback.title, playback.url) || "Idle";

    elements.deviceNameValue.textContent = device.deviceName || "-";
    elements.ipAddress.textContent = network.ip || "-";
    elements.apInfo.textContent = network.apMode ? `${network.apSsid || "AP active"}` : "Disabled";
    elements.wifiRssi.textContent = wifiConnected ? `${network.wifiRssi} dBm` : "-";
    elements.mqttStatus.textContent = mqttConnected ? "Connected" : "Disconnected";
    elements.firmwareVersion.textContent = `${firmware.version || "-"} (${firmware.buildDate || "-"})`;
    elements.freeHeap.textContent = formatBytes(status.system.freeHeap || status.system?.sram?.freeBytes || 0);
    elements.settingsSource.textContent = settings.usingSaved ? "Saved settings" : "Hardwired defaults";
    elements.playbackState.textContent = playback.state || "idle";
    elements.currentTitle.textContent = currentTitle;
    elements.currentTitle.title = currentTitle;
  }

  return {
    renderStatus,
  };
}