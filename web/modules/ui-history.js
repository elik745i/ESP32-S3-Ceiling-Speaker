function cloneValue(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function sameSnapshot(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function setElementValue(element, value) {
  if (!element) {
    return;
  }
  const normalized = String(value ?? "");
  if (element.tagName === "SELECT") {
    const hasOption = [...element.options].some((option) => String(option.value) === normalized);
    if (!hasOption) {
      return;
    }
  }
  element.value = normalized;
}

export function createUiHistoryModule({
  state,
  elements,
  currentSettingsSnapshot,
  fillForm,
  activeTabName,
  activateTabByName,
  queueSettingsSave,
  renderPeripheralDiagram,
  syncGpioMappingControls,
  historyLimit = 30,
}) {
  const historyState = {
    entries: [],
    index: -1,
    scheduledCaptureTimer: null,
    restoring: false,
  };

  function canUndo() {
    return historyState.index > 0;
  }

  function canRedo() {
    return historyState.index >= 0 && historyState.index < historyState.entries.length - 1;
  }

  function updateControls() {
    if (elements.peripheralDiagramUndoButton) {
      elements.peripheralDiagramUndoButton.disabled = !canUndo();
    }
    if (elements.peripheralDiagramRedoButton) {
      elements.peripheralDiagramRedoButton.disabled = !canRedo();
    }
  }

  function buildSnapshot() {
    // In the PC Designer, autosave keeps state.settings current. Re-collecting
    // and normalizing every form control for each undo point is needlessly
    // expensive in Qt WebEngine and can block the next click for seconds.
    const settings = document.body.classList.contains("local-builder-mode")
      ? state.settings
      : currentSettingsSnapshot?.();
    return {
      settings: cloneValue(settings || {}),
      activeTab: String(activeTabName?.() || "gpio"),
      playbackForm: {
        url: String(elements.playUrl?.value || ""),
        label: String(elements.playLabel?.value || ""),
        type: String(elements.playType?.value || "stream"),
      },
      radioBrowser: {
        country: String(elements.radioCountrySelect?.value || ""),
        station: String(elements.radioStationSelect?.value || ""),
      },
    };
  }

  function clearScheduledCapture() {
    if (historyState.scheduledCaptureTimer) {
      window.clearTimeout(historyState.scheduledCaptureTimer);
      historyState.scheduledCaptureTimer = null;
    }
  }

  function captureSnapshot(options = {}) {
    const { replace = false } = options;
    clearScheduledCapture();
    if (historyState.restoring || state.settingsLoading) {
      return false;
    }
    const snapshot = buildSnapshot();
    const current = historyState.entries[historyState.index] || null;
    if (current && sameSnapshot(current, snapshot)) {
      if (replace) {
        historyState.entries[historyState.index] = snapshot;
      }
      updateControls();
      return false;
    }

    if (replace && historyState.index >= 0) {
      historyState.entries[historyState.index] = snapshot;
      updateControls();
      return true;
    }

    historyState.entries = historyState.entries.slice(0, historyState.index + 1);
    historyState.entries.push(snapshot);
    if (historyState.entries.length > historyLimit) {
      historyState.entries.splice(0, historyState.entries.length - historyLimit);
    }
    historyState.index = historyState.entries.length - 1;
    updateControls();
    return true;
  }

  function scheduleCapture(delayMs) {
    clearScheduledCapture();
    const resolvedDelayMs = Number.isFinite(Number(delayMs))
      ? Math.max(0, Number(delayMs))
      : (document.body.classList.contains("local-builder-mode") ? 1200 : 0);
    historyState.scheduledCaptureTimer = window.setTimeout(() => {
      historyState.scheduledCaptureTimer = null;
      captureSnapshot();
    }, resolvedDelayMs);
  }

  function restoreSnapshot(snapshot) {
    if (!snapshot || historyState.restoring) {
      return false;
    }
    clearScheduledCapture();
    historyState.restoring = true;
    try {
      fillForm?.(cloneValue(snapshot.settings || {}));
      setElementValue(elements.playUrl, snapshot.playbackForm?.url || "");
      setElementValue(elements.playLabel, snapshot.playbackForm?.label || "");
      setElementValue(elements.playType, snapshot.playbackForm?.type || "stream");
      setElementValue(elements.radioCountrySelect, snapshot.radioBrowser?.country || "");
      setElementValue(elements.radioStationSelect, snapshot.radioBrowser?.station || "");
      activateTabByName?.(snapshot.activeTab || "gpio");
      syncGpioMappingControls?.();
      renderPeripheralDiagram?.();
      queueSettingsSave?.(0);
      return true;
    } finally {
      historyState.restoring = false;
      updateControls();
    }
  }

  function undo() {
    if (!canUndo()) {
      updateControls();
      return false;
    }
    historyState.index -= 1;
    return restoreSnapshot(historyState.entries[historyState.index]);
  }

  function redo() {
    if (!canRedo()) {
      updateControls();
      return false;
    }
    historyState.index += 1;
    return restoreSnapshot(historyState.entries[historyState.index]);
  }

  function handleShortcut(event) {
    if (event.defaultPrevented || !(event.ctrlKey || event.metaKey) || event.altKey) {
      return;
    }
    const key = String(event.key || "").toLowerCase();
    const redoRequested = key === "y" || (key === "z" && event.shiftKey);
    const undoRequested = key === "z" && !event.shiftKey;
    if (redoRequested && canRedo()) {
      event.preventDefault();
      redo();
      return;
    }
    if (undoRequested && canUndo()) {
      event.preventDefault();
      undo();
    }
  }

  function bindEvents() {
    elements.peripheralDiagramUndoButton?.addEventListener("click", () => {
      undo();
    });
    elements.peripheralDiagramRedoButton?.addEventListener("click", () => {
      redo();
    });
    elements.settingsForm?.addEventListener("input", () => {
      scheduleCapture();
    });
    elements.settingsForm?.addEventListener("change", () => {
      scheduleCapture();
    });
    elements.playForm?.addEventListener("input", () => {
      scheduleCapture();
    });
    elements.playForm?.addEventListener("change", () => {
      scheduleCapture();
    });
    document.addEventListener("keydown", handleShortcut);
    updateControls();
  }

  return {
    bindEvents,
    captureSnapshot,
    scheduleCapture,
    undo,
    redo,
    updateControls,
  };
}
