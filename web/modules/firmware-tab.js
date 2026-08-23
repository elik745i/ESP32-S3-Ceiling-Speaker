export function createFirmwareTab({ state, elements, request, loadStatus, setMessage, beginFirmwareReconnectReload, setCurrentFirmwareVersion }) {
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

    setMessage(`Uploading ${file.name}...`);
    elements.otaStatusLabel.textContent = "Uploading local firmware...";
    elements.otaProgressFill.style.width = "0%";
    elements.otaProgressLabel.textContent = "Uploading local firmware... 0%";
    startFirmwareProgressPolling();

    const formData = new FormData();
    formData.append("firmware", file, file.name);

    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/firmware/upload");

      xhr.upload.addEventListener("progress", (event) => {
        if (!event.lengthComputable) {
          return;
        }
        const percent = Math.max(0, Math.min(100, Math.round((event.loaded * 100) / event.total)));
        const deviceProgress = Number(state.status?.otaManager?.updateProgress || state.status?.ota?.updateProgress || 0);
        if (deviceProgress <= percent) {
          elements.otaProgressFill.style.width = `${percent}%`;
          elements.otaProgressLabel.textContent = `Uploading to ESP... ${percent}% (${event.loaded}/${event.total} bytes)`;
        }
      });

      xhr.addEventListener("load", async () => {
        let payload = {};
        try {
          payload = JSON.parse(xhr.responseText || "{}");
        } catch {
          payload = {};
        }

        if (xhr.status >= 200 && xhr.status < 300) {
          state.awaitingFirmwareReboot = true;
          setMessage(payload.message || "Local firmware uploaded.");
          try {
            await loadStatus();
          } catch {
          }
          beginFirmwareReconnectReload();
          resolve();
          return;
        }

        reject(new Error(payload.error || xhr.statusText || "Local firmware upload failed."));
      });

      xhr.addEventListener("error", () => reject(new Error("Local firmware upload failed.")));
      xhr.send(formData);
    }).catch((error) => {
      stopFirmwareProgressPolling();
      throw error;
    }).finally(() => {
      elements.localFirmwareFile.value = "";
      updateLocalFirmwareLabel();
    });
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
  };
}
