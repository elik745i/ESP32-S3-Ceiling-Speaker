export function createPlaybackStatusModule({
  state,
  elements,
  normalizePlaybackTitle,
  isPlaybackActive,
  toast,
  applySelectedRadioStation,
}) {
  function selectedRadioStation() {
    const selectedIndex = Number(elements.radioStationSelect?.value ?? -1);
    if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= state.radioStations.length) {
      return null;
    }
    return state.radioStations[selectedIndex] || null;
  }

  function currentPlaybackHeroTitle(status = state.status) {
    const playingTitle = normalizePlaybackTitle(status?.playback?.title, status?.playback?.url);
    if (playingTitle) {
      return playingTitle;
    }

    const selectedStation = selectedRadioStation();
    if (selectedStation?.name) {
      return selectedStation.name;
    }

    const manualLabel = normalizePlaybackTitle(elements.playLabel?.value, elements.playUrl?.value);
    if (manualLabel) {
      return manualLabel;
    }

    return "No station selected";
  }

  function updatePlaybackHeroControls() {
    const audioEnabled = Boolean(state.status?.firmware?.audioEnabled);
    const playbackActive = isPlaybackActive();
    const busy = Boolean(state.playbackActionInProgress);
    const stationStepReady = audioEnabled && state.radioStations.length > 0 && !elements.radioStationSelect?.disabled && !busy;
    const hasSelection = playbackActive || Boolean(String(elements.playUrl?.value || "").trim());

    if (elements.playbackPrevButton) {
      elements.playbackPrevButton.disabled = !stationStepReady;
      elements.playbackPrevButton.title = stationStepReady ? "Previous station" : "Load a station list first";
    }

    if (elements.playbackNextButton) {
      elements.playbackNextButton.disabled = !stationStepReady;
      elements.playbackNextButton.title = stationStepReady ? "Next station" : "Load a station list first";
    }

    if (!elements.playbackHeroToggleButton) {
      return;
    }

    const button = elements.playbackHeroToggleButton;
    button.classList.toggle("playing", playbackActive && !busy);

    if (state.playbackActionInProgress === "play") {
      button.textContent = "...";
      button.disabled = true;
      button.title = "Starting playback";
      button.setAttribute("aria-label", "Starting playback");
      return;
    }

    if (state.playbackActionInProgress === "stop") {
      button.textContent = "...";
      button.disabled = true;
      button.title = "Stopping playback";
      button.setAttribute("aria-label", "Stopping playback");
      return;
    }

    button.textContent = playbackActive ? "■" : "▶";
    button.disabled = !audioEnabled || (!playbackActive && !hasSelection);
    button.title = playbackActive ? "Stop playback" : "Play selected station";
    button.setAttribute("aria-label", playbackActive ? "Stop playback" : "Play selected station");
  }

  async function stepRadioStationSelection(delta) {
    if (state.playbackActionInProgress) {
      return;
    }

    if (!elements.radioStationSelect || !state.radioStations.length || elements.radioStationSelect.disabled) {
      toast("Load a station list first");
      return;
    }

    const stationCount = state.radioStations.length;
    const currentIndex = Number(elements.radioStationSelect.value ?? -1);
    const normalizedCurrentIndex = Number.isInteger(currentIndex) && currentIndex >= 0 && currentIndex < stationCount
      ? currentIndex
      : (delta >= 0 ? -1 : 0);
    const nextIndex = normalizedCurrentIndex < 0
      ? (delta >= 0 ? 0 : stationCount - 1)
      : (normalizedCurrentIndex + delta + stationCount) % stationCount;

    elements.radioStationSelect.value = String(nextIndex);
    await applySelectedRadioStation({ autoPlay: isPlaybackActive() });
    updatePlaybackHeroControls();
  }

  return {
    currentPlaybackHeroTitle,
    updatePlaybackHeroControls,
    stepRadioStationSelection,
  };
}