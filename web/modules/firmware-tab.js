export function createFirmwareTab({ state, elements, request, loadStatus, setMessage, beginFirmwareReconnectReload, setCurrentFirmwareVersion }) {
  const localUploadChunkSize = 16 * 1024;
  const localUploadRequestTimeoutMs = 60000;
  let localUploadSession = null;

  function delay(milliseconds) {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  }

  function setLocalUploadButtonActive(active) {
    if (!elements.uploadFirmwareButton) {
      return;
    }
    elements.uploadFirmwareButton.textContent = active
      ? "Cancel Upload Local Firmware"
      : "Upload Local Firmware";
    elements.uploadFirmwareButton.classList.toggle("danger", active);
  }

  function isLocalUploadActive() {
    return Boolean(localUploadSession && !localUploadSession.cancelled);
  }

  async function localUploadFetch(path, options = {}) {
    if (!localUploadSession || localUploadSession.cancelled) {
      throw new DOMException("Local firmware upload cancelled.", "AbortError");
    }
    const controller = new AbortController();
    localUploadSession.requestController = controller;
    const timeout = window.setTimeout(() => controller.abort(), localUploadRequestTimeoutMs);
    try {
      const response = await fetch(path, {
        cache: "no-store",
        credentials: "same-origin",
        ...options,
        signal: controller.signal,
      });
      let payload = {};
      try {
        payload = await response.json();
      } catch {
      }
      if (!response.ok) {
        const error = new Error(payload.error || response.statusText || `HTTP ${response.status}`);
        error.status = response.status;
        throw error;
      }
      return payload;
    } finally {
      window.clearTimeout(timeout);
      if (localUploadSession?.requestController === controller) {
        localUploadSession.requestController = null;
      }
    }
  }

  async function readLocalUploadStatus() {
    return localUploadFetch("/api/firmware/upload/status");
  }

  function localUploadProgress(offset, total, detail = "") {
    const accepted = Math.max(0, Math.min(total, Number(offset || 0)));
    const percent = total > 0 ? Math.round((accepted * 100) / total) : 0;
    elements.otaProgressFill.style.width = `${percent}%`;
    elements.otaProgressLabel.textContent = detail || `Uploading to ESP... ${percent}% (${accepted}/${total} bytes)`;
  }

  function isFatalLocalUploadError(error) {
    return /not a valid esp32|unsupported.*chip|chip-family|select a \.bin|empty|larger than|no writable ota|partition is unavailable/i.test(String(error?.message || error));
  }

  async function cancelLocalFirmwareUpload() {
    const session = localUploadSession;
    if (!session) {
      return;
    }
    session.cancelled = true;
    session.requestController?.abort();
    elements.otaStatusLabel.textContent = "Cancelling local firmware upload...";
    elements.otaProgressLabel.textContent = "Cancelling local firmware upload...";

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetch("/api/firmware/upload/cancel", {
          method: "POST",
          cache: "no-store",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: session.id }),
        });
        if (response.ok || response.status === 409) {
          break;
        }
      } catch {
      }
      await delay(500 + attempt * 750);
    }

    stopFirmwareProgressPolling();
    setMessage("Local firmware upload cancelled.");
    elements.otaStatusLabel.textContent = "Local firmware upload cancelled";
    elements.otaProgressLabel.textContent = "Upload cancelled safely; firmware was not activated.";
    if (localUploadSession === session) {
      localUploadSession = null;
      setLocalUploadButtonActive(false);
    }
  }
  function selectedFirmwareVersion() {
    const selected = document.querySelector('input[name="firmwareVersion"]:checked');
    if (!selected) {
      return null;
    }
    return {
      key: selected.value,
      version: selected.dataset.version || "",
      assetName: selected.dataset.assetName || "",
      label: selected.dataset.label || selected.dataset.version || selected.value,
    };
  }

  function updateFirmwareSelectionLabel() {
    const selected = selectedFirmwareVersion();
    state.firmwareSelectedVersion = selected?.key || "";
    if (elements.firmwareSelectionLabel) {
      elements.firmwareSelectionLabel.textContent = selected ? `Selected: ${selected.label}` : "No firmware selected";
    }
  }

  function showFirmwareListStatus(text, isError = false) {
    if (!elements.firmwareList) {
      return;
    }
    elements.firmwareList.innerHTML = "";
    const note = document.createElement("div");
    note.className = "note";
    note.textContent = text;
    if (isError) {
      note.style.color = "#b42318";
    }
    elements.firmwareList.appendChild(note);
    updateFirmwareSelectionLabel();
  }

  function renderRollbackStatus(info, currentVersion) {
    if (!elements.firmwareRollbackAlert) {
      return;
    }

    const pendingVerify = Boolean(info.rollbackPendingVerify);
    const pendingVersion = String(info.rollbackPendingVersion || "").trim();
    const rolledBackVersion = String(info.rolledBackVersion || "").trim();
    const reason = String(info.rollbackReason || "").trim();
    const hasRollback = Boolean(rolledBackVersion || reason);

    elements.firmwareRollbackAlert.hidden = !pendingVerify && !hasRollback;
    elements.firmwareRollbackAlert.classList.toggle("pending", pendingVerify && !hasRollback);
    elements.firmwareRollbackAlert.classList.toggle("failed", hasRollback);
    if (!pendingVerify && !hasRollback) {
      return;
    }

    if (hasRollback) {
      elements.firmwareRollbackTitle.textContent = "Firmware update failed — rollback completed";
      elements.firmwareRollbackSummary.textContent = `Attempted ${rolledBackVersion || "unknown firmware"}; restored ${currentVersion || "the previous firmware"}.`;
      elements.firmwareRollbackReason.textContent = reason || "The new firmware did not pass its post-update health confirmation.";
      return;
    }

    elements.firmwareRollbackTitle.textContent = "Firmware health confirmation pending";
    elements.firmwareRollbackSummary.textContent = `${pendingVersion || currentVersion || "The new firmware"} is running its post-update health check.`;
    elements.firmwareRollbackReason.textContent = "If health confirmation fails, the bootloader will restore the previous working image and show the cause here.";
  }

  function firmwareReleaseNote(release) {
    const variant = String(release?.variantLabel || "").toLowerCase();

    if (variant.includes("hacs slim")) {
      return "HACS slim build: MQTT media-player integration focused build with reduced local UI footprint.";
    }

    if (variant.includes("hacs")) {
      return "HACS build: best choice for Home Assistant MQTT Media Player integration and media-player style control.";
    }

    return "Standard build: general notifier firmware with the local web UI and the project’s default MQTT control model.";
  }

  function renderFirmwareList(releases, currentVersion, latestVersion, selectedVersion) {
    if (!elements.firmwareList) {
      return;
    }

    elements.firmwareList.innerHTML = "";
    if (!releases.length) {
      showFirmwareListStatus("No firmware releases are available right now.");
      return;
    }

    releases.forEach((release, index) => {
      const item = document.createElement("label");
      item.className = "firmware-item";

      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "firmwareVersion";
      radio.value = `${release.tag}|${release.assetName || index}`;
      radio.dataset.version = release.tag;
      radio.dataset.assetName = release.assetName || "";
      radio.dataset.label = `${release.tag} (${release.variantLabel || release.assetName || "firmware"})`;
      radio.checked = Boolean(
        (selectedVersion && radio.value === selectedVersion) ||
        (!selectedVersion && (release.isLatest || (!latestVersion && index === 0)))
      );
      radio.addEventListener("change", updateFirmwareSelectionLabel);

      const meta = document.createElement("div");
      meta.className = "firmware-meta";

      const title = document.createElement("div");
      title.className = "firmware-title";
      title.textContent = `${release.name || release.tag} ${release.variantLabel ? `(${release.variantLabel})` : ""}`.trim();

      const subtitle = document.createElement("div");
      subtitle.className = "firmware-subtitle";
      subtitle.textContent = `${release.tag} - ${release.publishedAt || "unknown date"} - ${release.assetName || "firmware asset"}`;

      const note = document.createElement("div");
      note.className = "firmware-note";
      note.textContent = firmwareReleaseNote(release);

      meta.appendChild(title);
      meta.appendChild(subtitle);
      meta.appendChild(note);

      const badges = document.createElement("div");
      badges.className = "badge-row";

      if (release.isInstalled) {
        const badge = document.createElement("span");
        badge.className = "badge current";
        badge.textContent = "Installed";
        badges.appendChild(badge);
      }

      if (release.isLatest || release.tag === latestVersion) {
        const badge = document.createElement("span");
        badge.className = `badge ${release.isNew ? "new" : "latest"}`;
        badge.textContent = release.isNew ? "New" : "Latest";
        badges.appendChild(badge);
      }

      if (release.prerelease) {
        const badge = document.createElement("span");
        badge.className = "badge";
        badge.textContent = "Pre-release";
        badges.appendChild(badge);
      }

      item.appendChild(radio);
      item.appendChild(meta);
      item.appendChild(badges);
      elements.firmwareList.appendChild(item);
    });

    updateFirmwareSelectionLabel();
  }

  async function refreshFirmwareInfo(forceRefresh = false) {
    state.firmwareReleasesLoading = true;
    if (elements.applyOtaButton) {
      elements.applyOtaButton.disabled = true;
    }
    if (forceRefresh) {
      elements.otaStatusLabel.textContent = "Checking releases...";
      showFirmwareListStatus("Checking available firmware releases...");
    }

    try {
      let info = await request(forceRefresh ? "/api/firmware?refresh=1" : "/api/firmware");
      let refreshPollAttempts = forceRefresh ? 60 : 0;

      while (refreshPollAttempts > 0 && (info.releaseRefreshPending || info.releaseRefreshInProgress)) {
        elements.otaStatusLabel.textContent = "Checking releases...";
        showFirmwareListStatus("Checking available firmware releases...");
        await new Promise((resolve) => window.setTimeout(resolve, 500));
        info = await request("/api/firmware");
        refreshPollAttempts -= 1;
      }

      const currentVersion = info.currentVersion || state.status?.firmware?.version || "-";
      const latestVersion = info.latestVersion || "No release";
      state.firmwareReleases = Array.isArray(info.releases) ? info.releases : state.firmwareReleases;
      state.firmwareLatestVersion = latestVersion;
      state.firmwareSelectedVersion = info.selectedVersion
        ? `${info.selectedVersion}|${info.selectedAssetName || ""}`
        : state.firmwareSelectedVersion;
      state.firmwareReleasesLoaded = true;

      setCurrentFirmwareVersion(currentVersion);
      elements.latestVersion.textContent = latestVersion;
      elements.otaStatusLabel.textContent = info.updateStatus || "Idle";
      elements.otaStatus.textContent = JSON.stringify(info, null, 2);
      renderRollbackStatus(info, currentVersion);

      const progress = Number(info.updateProgress || 0);
      const bytes = Number(info.updateBytes || 0);
      const totalBytes = Number(info.updateTotalBytes || 0);
      const phase = info.updatePhase || "";
      elements.otaProgressFill.style.width = `${Math.max(0, Math.min(100, progress))}%`;
      if (info.updateBusy || progress > 0) {
        const byteLabel = totalBytes > 0 ? ` (${bytes}/${totalBytes} bytes)` : "";
        elements.otaProgressLabel.textContent = `${phase || "Update"} ${progress}%${byteLabel}`;
      }

      if (info.error && !state.firmwareReleases.length) {
        showFirmwareListStatus(info.error, true);
      } else {
        renderFirmwareList(state.firmwareReleases, currentVersion, state.firmwareLatestVersion, state.firmwareSelectedVersion);
      }
    } finally {
      state.firmwareReleasesLoading = false;
      if (elements.applyOtaButton) {
        elements.applyOtaButton.disabled = false;
      }
    }
  }

  function stopFirmwareProgressPolling() {
    if (state.firmwareProgressPollTimer) {
      window.clearInterval(state.firmwareProgressPollTimer);
      state.firmwareProgressPollTimer = null;
    }
  }

  function startFirmwareProgressPolling() {
    if (state.firmwareProgressPollTimer) {
      return;
    }
    state.firmwareProgressPollTimer = window.setInterval(async () => {
      try {
        await loadStatus();
        const ota = state.status?.otaManager || state.status?.ota || {};
        const progress = Number(ota.updateProgress || 0);
        if (!ota.busy && (progress === 0 || progress >= 100)) {
          window.setTimeout(() => stopFirmwareProgressPolling(), 2000);
        }
      } catch {
        stopFirmwareProgressPolling();
      }
    }, 500);
  }

  async function checkOta() {
    await refreshFirmwareInfo(true);
    setMessage("Firmware releases refreshed");
  }

  async function installSelectedFirmware() {
    const selection = selectedFirmwareVersion();
    if (!selection?.version) {
      setMessage("Select a firmware release first.", true);
      return;
    }

    state.awaitingFirmwareReboot = true;
    startFirmwareProgressPolling();
    const result = await request("/api/firmware/update", {
      method: "POST",
      body: JSON.stringify({ version: selection.version, assetName: selection.assetName }),
    });
    elements.otaStatus.textContent = JSON.stringify(result, null, 2);
    setMessage(result.message || `Update queued for ${selection.label}`);
    await loadStatus();
  }

  function updateLocalFirmwareLabel() {
    const file = elements.localFirmwareFile?.files?.[0];
    elements.localFirmwareLabel.textContent = file ? `Local: ${file.name}` : "No local firmware selected";
  }

  async function uploadLocalFirmware() {
    const file = elements.localFirmwareFile?.files?.[0];
    if (!file) {
      setMessage("Select a local firmware .bin file first.", true);
      return;
    }
    if (!/\.bin$/i.test(file.name)) {
      setMessage("Select a .bin firmware image.", true);
      return;
    }
    if (file.size <= 0) {
      setMessage("Selected firmware file is empty.", true);
      return;
    }

    const session = {
      id: window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      cancelled: false,
      requestController: null,
      retryCount: 0,
    };
    localUploadSession = session;
    setLocalUploadButtonActive(true);
    setMessage(`Uploading ${file.name} with automatic resume...`);
    elements.otaStatusLabel.textContent = "Uploading local firmware...";
    elements.otaProgressFill.style.width = "0%";
    elements.otaProgressLabel.textContent = "Preparing resumable local firmware upload... 0%";
    startFirmwareProgressPolling();

    let offset = 0;
    let started = false;
    try {
      while (!session.cancelled && offset < file.size) {
        try {
          if (!started) {
            const start = await localUploadFetch("/api/firmware/upload/start", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sessionId: session.id, filename: file.name, size: file.size }),
            });
            offset = Number(start.upload?.offset || 0);
            started = true;
            session.retryCount = 0;
            localUploadProgress(offset, file.size);
          }

          const end = Math.min(file.size, offset + localUploadChunkSize);
          const chunk = file.slice(offset, end);
          const result = await localUploadFetch(
            `/api/firmware/upload/chunk?sessionId=${encodeURIComponent(session.id)}&offset=${offset}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/octet-stream" },
              body: chunk,
            },
          );
          const acknowledged = Number(result.upload?.offset ?? end);
          if (acknowledged <= offset || acknowledged > file.size) {
            throw new Error(`Device returned invalid resume offset ${acknowledged}.`);
          }
          offset = acknowledged;
          session.retryCount = 0;
          localUploadProgress(offset, file.size);
        } catch (error) {
          if (session.cancelled || error?.name === "AbortError" && session.cancelled) {
            break;
          }
          if (isFatalLocalUploadError(error)) {
            throw error;
          }

          session.retryCount += 1;
          try {
            const status = await readLocalUploadStatus();
            const upload = status.upload || {};
            if (upload.active && upload.sessionId === session.id) {
              offset = Math.max(0, Math.min(file.size, Number(upload.offset || 0)));
              started = true;
            } else {
              offset = 0;
              started = false;
            }
          } catch {
          }

          const retryDelay = Math.min(5000, 500 + session.retryCount * 500);
          const retryText = `Connection interrupted; retry ${session.retryCount} resumes at ${offset}/${file.size} bytes in ${(retryDelay / 1000).toFixed(1)}s. Press Cancel Upload Local Firmware to stop.`;
          localUploadProgress(offset, file.size, retryText);
          elements.otaStatusLabel.textContent = "Weak connection — upload will keep retrying";
          setMessage(retryText);
          await delay(retryDelay);
        }
      }

      if (session.cancelled) {
        return;
      }

      localUploadProgress(file.size, file.size, "Firmware received; validating and activating update...");
      let finishConfirmed = false;
      let lastFinishError = null;
      for (let attempt = 0; attempt < 3 && !session.cancelled; attempt += 1) {
        try {
          const result = await localUploadFetch("/api/firmware/upload/finish", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId: session.id }),
          });
          finishConfirmed = Boolean(result.ok);
          break;
        } catch (error) {
          lastFinishError = error;
          if (isFatalLocalUploadError(error)) {
            throw error;
          }
          await delay(750);
        }
      }
      if (!finishConfirmed && lastFinishError?.status) {
        throw lastFinishError;
      }

      // A successful finish schedules a reboot, so the last HTTP acknowledgement
      // can itself be lost. Reaching this point with every byte acknowledged is
      // sufficient to switch into reconnect monitoring.
      state.awaitingFirmwareReboot = true;
      setMessage(finishConfirmed ? "Local firmware uploaded. Device is restarting..." : "Firmware fully transferred; waiting for the device to restart...");
      elements.otaStatusLabel.textContent = "Local firmware transferred";
      beginFirmwareReconnectReload(2500);
      elements.localFirmwareFile.value = "";
      updateLocalFirmwareLabel();
    } finally {
      if (localUploadSession === session) {
        localUploadSession = null;
        setLocalUploadButtonActive(false);
      }
      if (!state.awaitingFirmwareReboot) {
        stopFirmwareProgressPolling();
      }
    }
  }

  return {
    selectedFirmwareVersion,
    updateFirmwareSelectionLabel,
    showFirmwareListStatus,
    renderFirmwareList,
    refreshFirmwareInfo,
    stopFirmwareProgressPolling,
    startFirmwareProgressPolling,
    checkOta,
    installSelectedFirmware,
    updateLocalFirmwareLabel,
    uploadLocalFirmware,
    cancelLocalFirmwareUpload,
    isLocalUploadActive,
  };
}
