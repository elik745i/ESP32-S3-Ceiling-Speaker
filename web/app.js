const state = {
  status: null,
  settings: null,
  recentPlayback: loadRecentPlayback(),
  radioCountries: [],
  radioStations: [],
  radioCountriesLoading: false,
  radioStationsLoading: false,
  wifiScanPollTimer: null,
  firmwareProgressPollTimer: null,
  firmwareReloadTimer: null,
  settingsSaveTimer: null,
  settingsDirty: false,
  settingsLoading: false,
  settingsSaving: false,
  wifiScanRequestId: 0,
  firmwareReleasesLoaded: false,
  firmwareReleasesLoading: false,
  firmwareReleases: [],
  firmwareLatestVersion: "",
  firmwareSelectedVersion: "",
  awaitingFirmwareReboot: false,
  firmwareReloadPending: false,
  wifiSelectionPending: false,
  wifiConnectInProgress: false,
  mqttConnectInProgress: false,
  mqttActionInProgress: "",
  playbackActionInProgress: "",
  stationRedirectInProgress: false,
  oledPreviewScrollTimer: null,
  oledPreviewScrollSignature: "",
  oledPreviewScrollOffset: 0,
};

const SETTINGS_AUTOSAVE_DELAY_MS = 900;
const ACTIVE_TAB_STORAGE_KEY = "notifierActiveTab";
const RADIO_SELECTION_STORAGE_KEY = "notifierRadioSelection";
const OLED_PREVIEW_SCROLL_INTERVAL_MS = 300;
const ESP32S3_I2S_GPIO_PINS = [9, 10, 11, 12];
const DEFAULT_ESP32S3_AUDIO_PINS = {
  ws: 12,
  bclk: 11,
  dout: 9,
};
const DEFAULT_ESP32S3_OLED_PREFERRED_PINS = {
  sda: 4,
  scl: 5,
};

const elements = {
  deviceTitle: document.getElementById("deviceTitle"),
  deviceNameValue: document.getElementById("deviceNameValue"),
  connectionState: document.getElementById("connectionState"),
  ipAddress: document.getElementById("ipAddress"),
  apInfo: document.getElementById("apInfo"),
  wifiRssi: document.getElementById("wifiRssi"),
  mqttStatus: document.getElementById("mqttStatus"),
  firmwareVersion: document.getElementById("firmwareVersion"),
  firmwareVersionCard: document.getElementById("firmwareVersionCard"),
  batteryVoltage: document.getElementById("batteryVoltage"),
  batteryRaw: document.getElementById("batteryRaw"),
  batteryAdcPin: document.getElementById("batteryAdcPin"),
  batteryMeasuredVoltage: document.getElementById("batteryMeasuredVoltage"),
  batteryDerivedMultiplier: document.getElementById("batteryDerivedMultiplier"),
  batteryPinSummary: document.getElementById("batteryPinSummary"),
  chargingSenseSummary: document.getElementById("chargingSenseSummary"),
  batteryNote: document.getElementById("batteryNote"),
  audioWsPin: document.getElementById("audioWsPin"),
  audioBclkPin: document.getElementById("audioBclkPin"),
  audioDoutPin: document.getElementById("audioDoutPin"),
  audioWsSummary: document.getElementById("audioWsSummary"),
  audioBclkSummary: document.getElementById("audioBclkSummary"),
  audioDoutSummary: document.getElementById("audioDoutSummary"),
  saveAudioButton: document.getElementById("saveAudioButton"),
  batteryHero: document.getElementById("batteryHero"),
  freeHeap: document.getElementById("freeHeap"),
  settingsSource: document.getElementById("settingsSource"),
  playbackState: document.getElementById("playbackState"),
  currentTitle: document.getElementById("currentTitle"),
  currentUrl: document.getElementById("currentUrl"),
  wifiPill: document.getElementById("wifiPill"),
  mqttPill: document.getElementById("mqttPill"),
  audioPill: document.getElementById("audioPill"),
  volumeSlider: document.getElementById("volumeSlider"),
  volumeValue: document.getElementById("volumeValue"),
  statusLedPin: document.getElementById("statusLedPin"),
  audioMutedToggle: document.getElementById("audioMutedToggle"),
  lowBatterySleepToggle: document.getElementById("lowBatterySleepToggle"),
  lowBatterySleepThreshold: document.getElementById("lowBatterySleepThreshold"),
  lowBatterySleepThresholdValue: document.getElementById("lowBatterySleepThresholdValue"),
  lowBatteryWakeIntervalMinutes: document.getElementById("lowBatteryWakeIntervalMinutes"),
  audioMutedNote: document.getElementById("audioMutedNote"),
  otaStatus: document.getElementById("otaStatus"),
  otaStatusLabel: document.getElementById("otaStatusLabel"),
  latestVersion: document.getElementById("latestVersion"),
  otaProgressFill: document.getElementById("otaProgressFill"),
  otaProgressLabel: document.getElementById("otaProgressLabel"),
  firmwareList: document.getElementById("firmwareList"),
  firmwareSelectionLabel: document.getElementById("firmwareSelectionLabel"),
  uploadFirmwareButton: document.getElementById("uploadFirmwareButton"),
  localFirmwareFile: document.getElementById("localFirmwareFile"),
  localFirmwareLabel: document.getElementById("localFirmwareLabel"),
  message: document.getElementById("message"),
  playForm: document.getElementById("playForm"),
  playbackActionButton: document.getElementById("playbackActionButton"),
  playUrl: document.getElementById("playUrl"),
  playLabel: document.getElementById("playLabel"),
  playType: document.getElementById("playType"),
  radioCountrySelect: document.getElementById("radioCountrySelect"),
  radioStationSelect: document.getElementById("radioStationSelect"),
  radioBrowserStatus: document.getElementById("radioBrowserStatus"),
  settingsForm: document.getElementById("settingsForm"),
  recentPlaybackList: document.getElementById("recentPlaybackList"),
  useStaticIpToggle: document.getElementById("useStaticIpToggle"),
  scanWifiButton: document.getElementById("scanWifiButton"),
  scanStatus: document.getElementById("scanStatus"),
  wifiNetworkList: document.getElementById("wifiNetworkList"),
  mqttConnectButton: document.getElementById("mqttConnectButton"),
  saveDeviceButton: document.getElementById("saveDeviceButton"),
  mqttConnectStatus: document.getElementById("mqttConnectStatus"),
  displayType: document.getElementById("displayType"),
  oledSdaPin: document.getElementById("oledSdaPin"),
  oledSclPin: document.getElementById("oledSclPin"),
  oledResetPin: document.getElementById("oledResetPin"),
  oledModeSection: document.getElementById("oledModeSection"),
  wapeModeSection: document.getElementById("wapeModeSection"),
  displayTriggerButton: document.getElementById("displayTriggerButton"),
  wapeTriggerPin: document.getElementById("wapeTriggerPin"),
  wapeTriggerEvent: document.getElementById("wapeTriggerEvent"),
  oledPreviewCard: document.getElementById("oledPreviewCard"),
  oledPreview: document.getElementById("oledPreview"),
  oledPreviewMeta: document.getElementById("oledPreviewMeta"),
  oledPreviewProgress: document.getElementById("oledPreviewProgress"),
  oledPreviewProgressLabel: document.getElementById("oledPreviewProgressLabel"),
  oledPreviewProgressFill: document.getElementById("oledPreviewProgressFill"),
  oledPreviewDisabled: document.getElementById("oledPreviewDisabled"),
};

function namedField(name) {
  return elements.settingsForm.elements.namedItem(name);
}

function oledPreviewNode(selector) {
  return elements.oledPreview?.querySelector(selector) || null;
}

function defaultButtonActionForField(fieldName) {
  return fieldName === "device.button1Action" ? "previous" : "next";
}

function currentI2sPins() {
  return [
    Number(elements.audioWsPin?.value || state.settings?.audio?.wsPin || 0),
    Number(elements.audioBclkPin?.value || state.settings?.audio?.bclkPin || 0),
    Number(elements.audioDoutPin?.value || state.settings?.audio?.doutPin || 0),
  ].filter((pin) => Number.isFinite(pin));
}

function hasDistinctI2sPins() {
  const pins = currentI2sPins().filter((pin) => pin >= 0);
  return pins.length === 3 && new Set(pins).size === 3;
}

function populateAudioI2sPinOptions(settings = state.settings) {
  const audioFields = [elements.audioWsPin, elements.audioBclkPin, elements.audioDoutPin];
  if (audioFields.some((field) => !field)) {
    return;
  }

  const selectedPins = {
    ws: String(elements.audioWsPin.value || settings?.audio?.wsPin || DEFAULT_ESP32S3_AUDIO_PINS.ws),
    bclk: String(elements.audioBclkPin.value || settings?.audio?.bclkPin || DEFAULT_ESP32S3_AUDIO_PINS.bclk),
    dout: String(elements.audioDoutPin.value || settings?.audio?.doutPin || DEFAULT_ESP32S3_AUDIO_PINS.dout),
  };

  for (const field of audioFields) {
    field.innerHTML = "";
    for (const pin of ESP32S3_I2S_GPIO_PINS) {
      const option = document.createElement("option");
      option.value = String(pin);
      option.textContent = `GPIO${pin}`;
      field.append(option);
    }
  }

  elements.audioWsPin.value = selectedPins.ws;
  elements.audioBclkPin.value = selectedPins.bclk;
  elements.audioDoutPin.value = selectedPins.dout;
}

function populateBatteryAdcPinOptions(settings = state.settings) {
  if (!elements.batteryAdcPin) {
    return;
  }

  const selectedPin = String(elements.batteryAdcPin.value || settings?.battery?.adcPin || "");
  const reservedPins = new Set(currentI2sPins());
  const statusLedPin = Number(elements.statusLedPin?.value || settings?.device?.statusLedPin || 0);
  if (Number.isFinite(statusLedPin) && statusLedPin > 0) {
    reservedPins.add(statusLedPin);
  }
  const adcPins = Array.from({ length: 20 }, (_, index) => index + 1)
    .filter((pin) => !reservedPins.has(pin));

  elements.batteryAdcPin.innerHTML = "";

  for (const pin of adcPins) {
    const option = document.createElement("option");
    option.value = String(pin);
    option.textContent = `GPIO${pin}`;
    elements.batteryAdcPin.append(option);
  }

  if (selectedPin && [...elements.batteryAdcPin.options].some((option) => option.value === selectedPin)) {
    elements.batteryAdcPin.value = selectedPin;
  }
}

function availableStatusLedPins() {
  const chipFamily = String(state.status?.firmware?.chipFamily || "esp32s3").toLowerCase();
  const maxPin = chipFamily === "esp32" ? 39 : 48;
  return Array.from({ length: maxPin + 1 }, (_, index) => index);
}

function statusLedPinLabel(pin) {
  const chipFamily = String(state.status?.firmware?.chipFamily || "esp32s3").toLowerCase();
  if (chipFamily === "esp32s3") {
    if (pin === 21) {
      return "GPIO21 (built-in WS2812)";
    }
    if (pin === 10) {
      return "GPIO10 (external RGB default)";
    }
  }
  return `GPIO${pin}`;
}

function populateStatusLedPinOptions(settings = state.settings) {
  if (!elements.statusLedPin) {
    return;
  }

  const selectedPin = String(elements.statusLedPin.value || settings?.device?.statusLedPin || "");
  const reservedPins = new Set(currentI2sPins());
  elements.statusLedPin.innerHTML = "";

  for (const pin of availableStatusLedPins()) {
    if (reservedPins.has(pin)) {
      continue;
    }
    const option = document.createElement("option");
    option.value = String(pin);
    option.textContent = statusLedPinLabel(pin);
    elements.statusLedPin.append(option);
  }

  if (selectedPin && [...elements.statusLedPin.options].some((option) => option.value === selectedPin)) {
    elements.statusLedPin.value = selectedPin;
  }
}

function chipMaxPin() {
  const chipFamily = String(state.status?.firmware?.chipFamily || "esp32s3").toLowerCase();
  return chipFamily === "esp32" ? 39 : 48;
}

function currentButtonPins() {
  const chipFamily = String(state.status?.firmware?.chipFamily || "esp32s3").toLowerCase();
  return chipFamily === "esp32" ? [5, 18] : [5, 6];
}

function reservedOledPins(settings = state.settings) {
  const reservedPins = new Set(currentI2sPins());
  const batteryAdcPin = Number(elements.batteryAdcPin?.value || settings?.battery?.adcPin || 0);
  const chargingSensePin = Number(settings?.battery?.chargingSensePin || 0);
  const statusLedPin = Number(elements.statusLedPin?.value || settings?.device?.statusLedPin || 0);

  if (Number.isFinite(batteryAdcPin) && batteryAdcPin >= 0) {
    reservedPins.add(batteryAdcPin);
  }
  if (Number.isFinite(chargingSensePin) && chargingSensePin > 0) {
    reservedPins.add(chargingSensePin);
  }
  if (Number.isFinite(statusLedPin) && statusLedPin >= 0) {
    reservedPins.add(statusLedPin);
  }
  for (const pin of currentButtonPins()) {
    reservedPins.add(pin);
  }

  return reservedPins;
}

function choosePreferredOledPins(settings = state.settings) {
  const preferredOrder = Array.from({ length: chipMaxPin() + 1 }, (_, index) => index);
  const reservedPins = reservedOledPins(settings);

  const pickPin = (preferredPins, excludePin = -1) => {
    for (const pin of [...preferredPins, ...preferredOrder]) {
      if (!Number.isFinite(pin) || pin === excludePin || reservedPins.has(pin) || pin < 0) {
        continue;
      }
      return pin;
    }
    return excludePin;
  };

  const selectedSda = Number(elements.oledSdaPin?.value || settings?.oled?.sdaPin || -1);
  const selectedScl = Number(elements.oledSclPin?.value || settings?.oled?.sclPin || -1);
  const safeSda = !reservedPins.has(selectedSda) && selectedSda >= 0
    ? selectedSda
    : pickPin([DEFAULT_ESP32S3_OLED_PREFERRED_PINS.sda, Number(settings?.oled?.sdaPin), 8, 13, 14, 15, 16, 17, 18, 19, 20]);
  const safeScl = !reservedPins.has(selectedScl) && selectedScl >= 0 && selectedScl !== safeSda
    ? selectedScl
    : pickPin([DEFAULT_ESP32S3_OLED_PREFERRED_PINS.scl, Number(settings?.oled?.sclPin), 13, 14, 15, 16, 17, 18, 19, 20], safeSda);

  return {
    sda: safeSda,
    scl: safeScl,
  };
}

function populateOledPinOptions(settings = state.settings) {
  const oledFields = [elements.oledSdaPin, elements.oledSclPin, elements.oledResetPin];
  if (oledFields.some((field) => !field)) {
    return;
  }

  const reservedPins = reservedOledPins(settings);
  const defaults = choosePreferredOledPins(settings);
  const selectedReset = String(elements.oledResetPin.value || settings?.oled?.resetPin || -1);

  elements.oledSdaPin.innerHTML = "";
  elements.oledSclPin.innerHTML = "";
  elements.oledResetPin.innerHTML = "";

  for (let pin = 0; pin <= chipMaxPin(); pin += 1) {
    if (reservedPins.has(pin)) {
      continue;
    }

    for (const field of [elements.oledSdaPin, elements.oledSclPin, elements.oledResetPin]) {
      const option = document.createElement("option");
      option.value = String(pin);
      option.textContent = `GPIO${pin}`;
      field.append(option.cloneNode(true));
    }
  }

  const resetDisabledOption = document.createElement("option");
  resetDisabledOption.value = "-1";
  resetDisabledOption.textContent = "Disabled";
  elements.oledResetPin.prepend(resetDisabledOption);

  if ([...elements.oledSdaPin.options].some((option) => option.value === String(defaults.sda))) {
    elements.oledSdaPin.value = String(defaults.sda);
  }
  if ([...elements.oledSclPin.options].some((option) => option.value === String(defaults.scl))) {
    elements.oledSclPin.value = String(defaults.scl);
  }
  if ([...elements.oledResetPin.options].some((option) => option.value === selectedReset)) {
    elements.oledResetPin.value = selectedReset;
  } else {
    elements.oledResetPin.value = "-1";
  }
}

function availableWapeTriggerPins(settings = state.settings) {
  const chipFamily = String(state.status?.firmware?.chipFamily || "esp32s3").toLowerCase();
  const maxPin = chipFamily === "esp32" ? 39 : 48;
  const reservedPins = new Set(currentI2sPins());
  const batteryAdcPin = Number(elements.batteryAdcPin?.value || settings?.battery?.adcPin || 0);
  const statusLedPin = Number(elements.statusLedPin?.value || settings?.device?.statusLedPin || 0);
  if (Number.isFinite(batteryAdcPin) && batteryAdcPin > 0) {
    reservedPins.add(batteryAdcPin);
  }
  if (Number.isFinite(statusLedPin) && statusLedPin > 0) {
    reservedPins.add(statusLedPin);
  }
  if (chipFamily === "esp32s3") {
    reservedPins.add(21);
  }
  return Array.from({ length: maxPin + 1 }, (_, index) => index)
    .filter((pin) => pin === 0 || !reservedPins.has(pin));
}

function populateWapeTriggerPinOptions(settings = state.settings) {
  if (!elements.wapeTriggerPin) {
    return;
  }

  const selectedPin = String(elements.wapeTriggerPin.value || settings?.oled?.wapeTriggerPin || "0");
  elements.wapeTriggerPin.innerHTML = "";

  for (const pin of availableWapeTriggerPins(settings)) {
    const option = document.createElement("option");
    option.value = String(pin);
    option.textContent = pin === 0 ? "Disabled" : `GPIO${pin}`;
    elements.wapeTriggerPin.append(option);
  }

  if ([...elements.wapeTriggerPin.options].some((option) => option.value === selectedPin)) {
    elements.wapeTriggerPin.value = selectedPin;
  } else {
    elements.wapeTriggerPin.value = "0";
  }
}

function updateDisplayModeUi() {
  const displayType = String(elements.displayType?.value || state.settings?.oled?.displayType || "oled").toLowerCase();
  const oledSelected = displayType !== "wape";
  const oledEnabledField = namedField("oled.enabled");
  if (elements.oledModeSection) {
    elements.oledModeSection.hidden = !oledSelected;
  }
  if (elements.wapeModeSection) {
    elements.wapeModeSection.hidden = oledSelected;
  }
  if (oledEnabledField) {
    oledEnabledField.disabled = !oledSelected;
  }
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&nbsp;", " ");
}

function safeDecodePercentEncoding(value, plusAsSpace = false) {
  const input = String(value || "");
  try {
    return decodeURIComponent(plusAsSpace ? input.replaceAll("+", " ") : input);
  } catch {
    return input;
  }
}

function derivePlaybackTitleFromUrl(url) {
  const rawUrl = String(url || "").trim();
  if (!rawUrl) {
    return "";
  }

  const trimmed = rawUrl.split("#", 1)[0].split("?", 1)[0];
  const lastSlash = trimmed.lastIndexOf("/");
  const filename = lastSlash >= 0 ? trimmed.slice(lastSlash + 1) : trimmed;
  return decodeHtmlEntities(safeDecodePercentEncoding(filename).replaceAll("_", " ")).replace(/\s+/g, " ").trim();
}

function normalizePlaybackTitle(title, fallbackUrl = "") {
  let nextTitle = String(title || "").trim();
  if (!nextTitle) {
    return derivePlaybackTitleFromUrl(fallbackUrl);
  }

  const streamTitleMatch = nextTitle.match(/StreamTitle=(['"]?)(.*)\1;?/i);
  if (streamTitleMatch?.[2]) {
    nextTitle = streamTitleMatch[2];
  }

  nextTitle = decodeHtmlEntities(safeDecodePercentEncoding(nextTitle, true)).replace(/^['"]+|['"]+$/g, "").replace(/\s+/g, " ").trim();
  if (!nextTitle) {
    return derivePlaybackTitleFromUrl(fallbackUrl);
  }

  if (/^https?:\/\//i.test(nextTitle) || nextTitle.includes("authSig=")) {
    return derivePlaybackTitleFromUrl(nextTitle || fallbackUrl);
  }

  return nextTitle;
}

function availableButtonActionOptions() {
  const audioEnabled = Boolean(state.status?.firmware?.audioEnabled ?? true);
  const options = [
    { value: "none", label: "No Action" },
    { value: "ha_previous", label: "Home Assistant Previous Event" },
    { value: "ha_next", label: "Home Assistant Next Event" },
    { value: "volume_down", label: "Volume Down (-5%)" },
    { value: "volume_up", label: "Volume Up (+5%)" },
  ];

  if (!audioEnabled) {
    return options;
  }

  return [
    { value: "previous", label: "Previous Track" },
    { value: "next", label: "Next Track" },
    { value: "play_pause", label: "Play / Pause" },
    { value: "replay_current", label: "Replay Current" },
    { value: "stop", label: "Stop Playback" },
    ...options,
  ];
}

function populateButtonActionSelect(fieldName) {
  const field = namedField(fieldName);
  if (!field) {
    return;
  }

  const options = availableButtonActionOptions();
  const signature = options.map((option) => option.value).join("|");
  const key = fieldName.split(".").pop();
  const currentValue = String(field.value || state.settings?.device?.[key] || defaultButtonActionForField(fieldName)).trim();

  if (field.dataset.optionSignature !== signature) {
    field.innerHTML = "";
    for (const optionConfig of options) {
      const option = document.createElement("option");
      option.value = optionConfig.value;
      option.textContent = optionConfig.label;
      field.appendChild(option);
    }
    field.dataset.optionSignature = signature;
  }

  const values = [...field.options].map((option) => option.value);
  field.value = values.includes(currentValue) ? currentValue : defaultButtonActionForField(fieldName);
}

function populateButtonActionSelects() {
  populateButtonActionSelect("device.button1Action");
  populateButtonActionSelect("device.button2Action");
}

function loadRecentPlayback() {
  try {
    return JSON.parse(window.localStorage.getItem("notifierRecentPlayback") || "[]");
  } catch {
    return [];
  }
}

function saveRecentPlayback() {
  window.localStorage.setItem("notifierRecentPlayback", JSON.stringify(state.recentPlayback.slice(0, 6)));
}

function loadSavedRadioSelection() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(RADIO_SELECTION_STORAGE_KEY) || "{}");
    return {
      country: String(stored.country || "").trim(),
      stationName: String(stored.stationName || "").trim(),
      stationUrl: String(stored.stationUrl || "").trim(),
    };
  } catch {
    return { country: "", stationName: "", stationUrl: "" };
  }
}

function saveRadioSelection(selection) {
  try {
    window.localStorage.setItem(RADIO_SELECTION_STORAGE_KEY, JSON.stringify({
      country: String(selection?.country || "").trim(),
      stationName: String(selection?.stationName || "").trim(),
      stationUrl: String(selection?.stationUrl || "").trim(),
    }));
  } catch {
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

function radioBrowserApiUrl(path) {
  return `https://all.api.radio-browser.info/json${path}`;
}

function setRadioBrowserStatus(message, isError = false) {
  if (!elements.radioBrowserStatus) {
    return;
  }
  elements.radioBrowserStatus.textContent = message;
  elements.radioBrowserStatus.style.color = isError ? "#b42318" : "";
}

function resetRadioStationSelect(placeholder = "Select a country first") {
  if (!elements.radioStationSelect) {
    return;
  }
  elements.radioStationSelect.innerHTML = "";
  const option = document.createElement("option");
  option.value = "";
  option.textContent = placeholder;
  elements.radioStationSelect.appendChild(option);
  elements.radioStationSelect.value = "";
  elements.radioStationSelect.disabled = true;
}

function renderRadioCountries(countries) {
  if (!elements.radioCountrySelect) {
    return;
  }

  const savedSelection = loadSavedRadioSelection();
  const previousValue = elements.radioCountrySelect.value || savedSelection.country;
  elements.radioCountrySelect.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = countries.length ? "Select a country" : "No countries available";
  elements.radioCountrySelect.appendChild(placeholder);

  countries.forEach((country) => {
    const option = document.createElement("option");
    option.value = country.name;
    option.textContent = `${country.name} (${country.stationCount})`;
    elements.radioCountrySelect.appendChild(option);
  });

  if (countries.some((country) => country.name === previousValue)) {
    elements.radioCountrySelect.value = previousValue;
  }
}

function renderRadioStations(stations) {
  if (!elements.radioStationSelect) {
    return;
  }

  elements.radioStationSelect.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = stations.length ? "Select a station" : "No stations found";
  elements.radioStationSelect.appendChild(placeholder);

  stations.forEach((station, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = station.name;
    elements.radioStationSelect.appendChild(option);
  });

  elements.radioStationSelect.disabled = !stations.length;
}

async function loadRadioCountries(forceRefresh = false) {
  if (state.radioCountriesLoading) {
    return;
  }
  if (state.radioCountries.length && !forceRefresh) {
    renderRadioCountries(state.radioCountries);
    return;
  }

  state.radioCountriesLoading = true;
  setRadioBrowserStatus("Loading countries...");

  try {
    const response = await fetch(radioBrowserApiUrl("/countries"), {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Radio Browser countries failed: ${response.status}`);
    }

    const payload = await response.json();
    state.radioCountries = (Array.isArray(payload) ? payload : [])
      .map((country) => ({
        name: String(country.name || "").trim(),
        stationCount: Number(country.stationcount || 0),
      }))
      .filter((country) => country.name)
      .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: "base" }));

    renderRadioCountries(state.radioCountries);
    resetRadioStationSelect();
    setRadioBrowserStatus(state.radioCountries.length ? "Choose a country to load stations." : "No countries available.");

    const savedSelection = loadSavedRadioSelection();
    if (savedSelection.country && state.radioCountries.some((country) => country.name === savedSelection.country)) {
      elements.radioCountrySelect.value = savedSelection.country;
      await loadRadioStations(savedSelection.country);
    }
  } catch (error) {
    renderRadioCountries([]);
    resetRadioStationSelect("Radio Browser unavailable");
    setRadioBrowserStatus(error.message, true);
  } finally {
    state.radioCountriesLoading = false;
  }
}

async function loadRadioStations(countryName) {
  const trimmedCountry = String(countryName || "").trim();
  state.radioStations = [];

  if (!trimmedCountry) {
    resetRadioStationSelect();
    setRadioBrowserStatus(state.radioCountries.length ? "Choose a country to load stations." : "Loading countries...");
    return;
  }

  state.radioStationsLoading = true;
  resetRadioStationSelect("Loading stations...");
  setRadioBrowserStatus(`Loading stations for ${trimmedCountry}...`);
  saveRadioSelection({ country: trimmedCountry });

  try {
    const response = await fetch(
      `${radioBrowserApiUrl(`/stations/bycountry/${encodeURIComponent(trimmedCountry)}`)}?hidebroken=true&order=name`,
      {
        headers: { Accept: "application/json" },
        cache: "no-store",
      },
    );
    if (!response.ok) {
      throw new Error(`Radio Browser stations failed: ${response.status}`);
    }

    const payload = await response.json();
    state.radioStations = (Array.isArray(payload) ? payload : [])
      .map((station) => ({
        name: String(station.name || "").trim(),
        url: String(station.url_resolved || station.url || "").trim(),
        codec: String(station.codec || "").trim(),
        bitrate: Number(station.bitrate || 0),
      }))
      .filter((station) => station.name && station.url)
      .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: "base" }));

    renderRadioStations(state.radioStations);

    const savedSelection = loadSavedRadioSelection();
    const savedIndex = state.radioStations.findIndex((station) => (
      (savedSelection.stationUrl && station.url === savedSelection.stationUrl) ||
      (savedSelection.stationName && station.name === savedSelection.stationName)
    ));
    if (savedIndex >= 0 && elements.radioStationSelect) {
      elements.radioStationSelect.value = String(savedIndex);
      applySelectedRadioStation();
    }

    setRadioBrowserStatus(
      state.radioStations.length
        ? `Loaded ${state.radioStations.length} station(s) for ${trimmedCountry}.`
        : `No stations found for ${trimmedCountry}.`,
    );
  } catch (error) {
    resetRadioStationSelect("Station list unavailable");
    setRadioBrowserStatus(error.message, true);
  } finally {
    state.radioStationsLoading = false;
  }
}

function applySelectedRadioStation() {
  const selectedIndex = Number(elements.radioStationSelect?.value ?? -1);
  if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= state.radioStations.length) {
    return;
  }

  const station = state.radioStations[selectedIndex];
  if (!station) {
    return;
  }

  if (elements.playUrl) {
    elements.playUrl.value = station.url;
  }
  if (elements.playLabel) {
    elements.playLabel.value = station.name;
  }
  if (elements.playType) {
    elements.playType.value = "stream";
  }

  saveRadioSelection({
    country: elements.radioCountrySelect?.value || "",
    stationName: station.name,
    stationUrl: station.url,
  });

  const meta = [];
  if (station.codec) {
    meta.push(station.codec.toUpperCase());
  }
  if (station.bitrate > 0) {
    meta.push(`${station.bitrate} kbps`);
  }
  setRadioBrowserStatus(meta.length ? `${station.name} selected (${meta.join(" | ")}).` : `${station.name} selected.`);
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

function beginFirmwareReconnectReload(initialDelayMs = 12000) {
  if (state.firmwareReloadPending) {
    return;
  }
  state.firmwareReloadPending = true;
  if (state.firmwareReloadTimer) {
    window.clearTimeout(state.firmwareReloadTimer);
  }
  state.firmwareReloadTimer = window.setTimeout(async function pollDeviceReturn() {
    try {
      await fetch(`/api/status?ts=${Date.now()}`, { cache: "no-store" });
      window.location.reload();
      return;
    } catch {
      state.firmwareReloadTimer = window.setTimeout(pollDeviceReturn, 3000);
    }
  }, initialDelayMs);
}

function setPill(element, label, mode) {
  element.textContent = label;
  element.className = `stat-value ${mode}`;
}

function toast(message) {
  const template = document.getElementById("toastTemplate");
  const node = template.content.firstElementChild.cloneNode(true);
  node.textContent = message;
  document.body.appendChild(node);
  window.setTimeout(() => node.remove(), 2500);
}

function setMessage(message, isError = false) {
  elements.message.textContent = message;
  elements.message.style.color = isError ? "#b42318" : "#333333";
}

function setScanStatus(message, isError = false) {
  elements.scanStatus.textContent = message;
  elements.scanStatus.style.color = isError ? "#b42318" : "";
}

function setMqttConnectStatus(message, isError = false) {
  if (!elements.mqttConnectStatus) {
    return;
  }
  elements.mqttConnectStatus.textContent = message;
  elements.mqttConnectStatus.style.color = isError ? "#b42318" : "";
}

function isApHost() {
  const host = String(window.location.hostname || "").trim();
  return host === "192.168.4.1";
}

function usableStationIp(status) {
  const stationIp = String(status?.network?.ip || "").trim();
  if (!status?.network?.wifiConnected || !stationIp || stationIp === "0.0.0.0" || stationIp === "192.168.4.1") {
    return "";
  }
  return stationIp;
}

function maybeRedirectToStationIp(status, { force = false } = {}) {
  if (state.stationRedirectInProgress) {
    return;
  }

  const stationIp = usableStationIp(status);
  if (!stationIp || stationIp === window.location.hostname || (!force && !isApHost())) {
    return;
  }

  state.stationRedirectInProgress = true;
  setMessage(`Wi-Fi connected. Redirecting to ${stationIp}...`);
  window.setTimeout(() => {
    window.location.href = `http://${stationIp}/`;
  }, 1200);
}

function isNumericLikeField(field) {
  return field?.type === "number" || field?.id === "batteryMeasuredVoltage";
}

function normalizeDecimalField(field) {
  if (!field || !isNumericLikeField(field) || typeof field.value !== "string") {
    return;
  }
  const normalized = field.value.replaceAll(",", ".");
  if (normalized !== field.value) {
    field.value = normalized;
  }
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function settingsSubsetMatches(actual, expected) {
  if (expected === null || typeof expected !== "object") {
    if (typeof expected === "number") {
      return Math.abs(Number(actual ?? 0) - expected) < 0.0005;
    }
    if (typeof expected === "boolean") {
      return Boolean(actual) === expected;
    }
    return String(actual ?? "") === String(expected ?? "");
  }

  return Object.entries(expected).every(([key, value]) => settingsSubsetMatches(actual?.[key], value));
}

async function refreshSettingsAfterSave(expectedSettings, attempts = 8, delayMs = 250) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const loadedSettings = await request("/api/settings");
    if (settingsSubsetMatches(loadedSettings, expectedSettings)) {
      state.settings = loadedSettings;
      fillForm(loadedSettings);
      return true;
    }

    await delay(delayMs);
  }

  return false;
}

async function pollStatusUntil(predicate, attempts, delayMs) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    await loadStatus();
    if (predicate(state.status)) {
      return true;
    }
    await delay(delayMs);
  }

  return false;
}

async function waitForSettingsIdle(attempts = 50, delayMs = 100) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (!state.settingsLoading && !state.settingsSaving) {
      return true;
    }
    await delay(delayMs);
  }

  return !state.settingsLoading && !state.settingsSaving;
}

function oledDimensions() {
  const configuredWidth = Number(namedField("oled.width")?.value || state.settings?.oled?.width || 128);
  const configuredHeight = Number(namedField("oled.height")?.value || state.settings?.oled?.height || 64);
  const rotation = Number(namedField("oled.rotation")?.value || state.settings?.oled?.rotation || 0);
  const swapped = rotation === 90 || rotation === 270;

  return {
    configuredWidth,
    configuredHeight,
    rotation,
    effectiveWidth: swapped ? configuredHeight : configuredWidth,
    effectiveHeight: swapped ? configuredWidth : configuredHeight,
  };
}

function charsForWidth(width, textSize) {
  return Math.max(4, Math.floor(width / (6 * textSize)));
}

function oledTopDividerY(height) {
  return Math.min(11, Math.floor(height / 4));
}

function oledBottomDividerY(height) {
  return Math.max(height - 12, height - 12);
}

function truncateOledText(text, maxChars) {
  const value = String(text || "");
  if (value.length <= maxChars) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxChars - 1))}~`;
}

function oledScrollWindow(text, maxChars, offset) {
  const value = String(text || "");
  if (value.length <= maxChars) {
    return value;
  }

  const padded = `${value}   `;
  const start = offset % padded.length;
  if (start + maxChars <= padded.length) {
    return padded.slice(start, start + maxChars);
  }

  const end = (start + maxChars) - padded.length;
  return `${padded.slice(start)}${padded.slice(0, end)}`;
}

function stopOledPreviewScroll(centerNode) {
  if (state.oledPreviewScrollTimer) {
    clearInterval(state.oledPreviewScrollTimer);
    state.oledPreviewScrollTimer = null;
  }
  state.oledPreviewScrollSignature = "";
  state.oledPreviewScrollOffset = 0;
  if (centerNode) {
    centerNode.dataset.scrollText = "";
    centerNode.dataset.scrollChars = "";
  }
}

function renderOledPreviewCenter(centerNode, text, maxChars, hidden) {
  if (!centerNode) {
    stopOledPreviewScroll(null);
    return;
  }

  centerNode.hidden = hidden;
  if (hidden) {
    centerNode.textContent = "";
    stopOledPreviewScroll(centerNode);
    return;
  }

  const value = String(text || "");
  if (value.length <= maxChars) {
    centerNode.textContent = truncateOledText(value, maxChars);
    stopOledPreviewScroll(centerNode);
    return;
  }

  const signature = `${value}\n${maxChars}`;
  if (state.oledPreviewScrollSignature !== signature) {
    stopOledPreviewScroll(centerNode);
    state.oledPreviewScrollSignature = signature;
  }

  centerNode.dataset.scrollText = value;
  centerNode.dataset.scrollChars = String(maxChars);

  const drawFrame = () => {
    centerNode.textContent = oledScrollWindow(value, maxChars, state.oledPreviewScrollOffset);
    state.oledPreviewScrollOffset = (state.oledPreviewScrollOffset + 1) % (`${value}   `.length);
  };

  drawFrame();
  if (!state.oledPreviewScrollTimer) {
    state.oledPreviewScrollTimer = setInterval(drawFrame, OLED_PREVIEW_SCROLL_INTERVAL_MS);
  }
}

function oledCenterText(status) {
  if (!status) {
    return "Idle";
  }
  if (status.ota?.busy) {
    return status.ota.phase || "OTA updating";
  }
  if (status.system?.lastError) {
    return status.system.lastError;
  }
  if (status.playback?.state === "playing") {
    return normalizePlaybackTitle(status.playback.title, status.playback.url) || "Playing";
  }
  if (status.network?.apMode && !status.network?.wifiConnected) {
    return "AP setup mode";
  }
  if (!status.network?.wifiConnected) {
    return "Connecting Wi-Fi";
  }
  return "Idle";
}

function renderOledPreview() {
  if (!elements.oledPreview) {
    return;
  }

  if (String(elements.displayType?.value || state.settings?.oled?.displayType || "oled").toLowerCase() === "wape") {
    if (elements.oledPreviewCard) {
      elements.oledPreviewCard.hidden = true;
    }
    return;
  }

  if (elements.oledPreviewCard) {
    elements.oledPreviewCard.hidden = false;
  }

  const status = state.status;
  const enabled = Boolean(namedField("oled.enabled")?.checked ?? state.settings?.oled?.enabled ?? true);
  const { configuredWidth, configuredHeight, rotation, effectiveWidth, effectiveHeight } = oledDimensions();
  const topChars = charsForWidth(effectiveWidth, 1);
  const centerChars = charsForWidth(effectiveWidth, 2);
  const bottomChars = charsForWidth(effectiveWidth, 1);

  const top = status?.network?.wifiConnected
    ? status.network.ip
    : (status?.network?.apMode ? status.network.apSsid : "Booting");
  const center = oledCenterText(status);
  const bottom = `${status?.network?.wifiConnected ? "WiFi" : "AP"} ${Number(status?.battery?.voltage || 0).toFixed(2)}V ${status?.network?.mqttConnected ? "MQTT" : "noMQTT"}`;
  const isUpdating = Boolean(status?.ota?.busy);
  const progress = Number(status?.ota?.progressPercent || 0);
  const topDivider = oledTopDividerY(effectiveHeight);
  const bottomDivider = oledBottomDividerY(effectiveHeight);
  const centerTop = topDivider + 6;
  const centerBottom = bottomDivider - 5;
  const centerHeight = Math.max(18, centerBottom - centerTop);
  const labelY = centerTop;
  const progressBarHeight = 12;
  const progressBarY = Math.min(centerBottom - progressBarHeight, labelY + 12);

  const topNode = oledPreviewNode(".oled-preview-top");
  const centerNode = oledPreviewNode(".oled-preview-center");
  const bottomNode = oledPreviewNode(".oled-preview-bottom");
  const topDividerNode = oledPreviewNode(".oled-preview-divider-top");
  const bottomDividerNode = oledPreviewNode(".oled-preview-divider-bottom");
  if (topNode) {
    topNode.textContent = truncateOledText(top, topChars);
  }
  if (centerNode) {
    renderOledPreviewCenter(centerNode, center, centerChars, isUpdating);
    centerNode.style.top = `${(centerTop / effectiveHeight) * 100}%`;
    centerNode.style.height = `${(centerHeight / effectiveHeight) * 100}%`;
  }
  if (bottomNode) {
    bottomNode.textContent = truncateOledText(bottom, bottomChars);
  }
  if (topDividerNode) {
    topDividerNode.style.top = `${(topDivider / effectiveHeight) * 100}%`;
  }
  if (bottomDividerNode) {
    bottomDividerNode.style.top = `${(bottomDivider / effectiveHeight) * 100}%`;
  }

  if (elements.oledPreviewProgress) {
    elements.oledPreviewProgress.hidden = !isUpdating;
    elements.oledPreviewProgress.style.top = `${(centerTop / effectiveHeight) * 100}%`;
    elements.oledPreviewProgress.style.height = `${(centerHeight / effectiveHeight) * 100}%`;
  }
  if (elements.oledPreviewProgressLabel) {
    elements.oledPreviewProgressLabel.textContent = `${status?.ota?.phase || "Updating"} ${progress}%`;
    elements.oledPreviewProgressLabel.style.minHeight = `${(12 / effectiveHeight) * 100}%`;
  }
  if (elements.oledPreviewProgressFill) {
    elements.oledPreviewProgressFill.style.width = `${Math.max(0, Math.min(100, progress))}%`;
  }
  if (elements.oledPreviewDisabled) {
    elements.oledPreviewDisabled.hidden = enabled;
  }

  elements.oledPreview.style.aspectRatio = `${effectiveWidth} / ${effectiveHeight}`;
  if (elements.oledPreviewMeta) {
    const orientation = rotation === 90 || rotation === 270 ? "portrait" : "landscape";
    elements.oledPreviewMeta.textContent = `${configuredWidth} x ${configuredHeight} • ${rotation} deg • ${effectiveWidth} x ${effectiveHeight} effective ${orientation}`;
  }
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }
  const contentType = response.headers.get("content-type") || "";
  return contentType.includes("application/json") ? response.json() : response.text();
}

function fillForm(data) {
  state.settingsLoading = true;
  populateAudioI2sPinOptions(data);
  populateStatusLedPinOptions(data);
  populateOledPinOptions(data);
  populateWapeTriggerPinOptions(data);
  populateButtonActionSelects();
  for (const [section, sectionValue] of Object.entries(data)) {
    if (sectionValue === null || typeof sectionValue !== "object") {
      continue;
    }
    for (const [key, value] of Object.entries(sectionValue)) {
      const field = elements.settingsForm.elements.namedItem(`${section}.${key}`);
      if (!field) {
        continue;
      }
      if (field.type === "checkbox") {
        field.checked = Boolean(value);
      } else {
        field.value = value ?? "";
      }
    }
  }
  if (elements.audioWsPin && data.audio?.wsPin !== undefined) {
    elements.audioWsPin.value = String(data.audio.wsPin);
  }
  if (elements.audioBclkPin && data.audio?.bclkPin !== undefined) {
    elements.audioBclkPin.value = String(data.audio.bclkPin);
  }
  if (elements.audioDoutPin && data.audio?.doutPin !== undefined) {
    elements.audioDoutPin.value = String(data.audio.doutPin);
  }
  if (elements.statusLedPin && data.device?.statusLedPin !== undefined) {
    elements.statusLedPin.value = String(data.device.statusLedPin);
  }
  if (elements.oledSdaPin && data.oled?.sdaPin !== undefined && [...elements.oledSdaPin.options].some((option) => option.value === String(data.oled.sdaPin))) {
    elements.oledSdaPin.value = String(data.oled.sdaPin);
  }
  if (elements.oledSclPin && data.oled?.sclPin !== undefined && [...elements.oledSclPin.options].some((option) => option.value === String(data.oled.sclPin))) {
    elements.oledSclPin.value = String(data.oled.sclPin);
  }
  if (elements.oledResetPin && data.oled?.resetPin !== undefined && [...elements.oledResetPin.options].some((option) => option.value === String(data.oled.resetPin))) {
    elements.oledResetPin.value = String(data.oled.resetPin);
  }
  populateBatteryAdcPinOptions(data);
  if (elements.batteryAdcPin && data.battery?.adcPin !== undefined) {
    elements.batteryAdcPin.value = String(data.battery.adcPin);
  }
  if (elements.audioMutedToggle && data.device?.audioMuted !== undefined) {
    elements.audioMutedToggle.checked = Boolean(data.device.audioMuted);
  }
  if (elements.volumeSlider && data.device?.savedVolumePercent !== undefined) {
    elements.volumeSlider.value = String(data.device.savedVolumePercent);
  }
  populateButtonActionSelects();
  const measuredVoltage = state.status?.battery?.voltage ?? (data.battery?.calibrationMultiplier && state.status?.battery?.rawAdcVoltage
    ? data.battery.calibrationMultiplier * state.status.battery.rawAdcVoltage
    : "");
  if (elements.batteryMeasuredVoltage && measuredVoltage) {
    elements.batteryMeasuredVoltage.value = Number(measuredVoltage).toFixed(3);
  }
  updateDerivedBatteryCalibration();
  updateBatteryUi();
  updateAudioI2sUi();
  updateAudioUiState();
  updateLowBatterySleepUi();
  updateConditionalVisibility();
  updateDisplayModeUi();
  renderOledPreview();
  state.settingsDirty = false;
  state.settingsLoading = false;
}

function updateAudioUiState() {
  const muted = Boolean(elements.audioMutedToggle?.checked);
  const audioEnabled = Boolean(state.status?.firmware?.audioEnabled ?? false);
  if (elements.audioMutedNote) {
    if (!hasDistinctI2sPins()) {
      elements.audioMutedNote.textContent = "Pick three different GPIOs for I2S LRC/WS, BCLK, and DIN. The mapping will be saved after the combination becomes valid.";
      return;
    }
    if (!audioEnabled) {
      elements.audioMutedNote.textContent = "Audio playback is disabled in this diagnostic firmware build, so Play requests will not produce sound until audio is re-enabled in firmware.";
      return;
    }
    elements.audioMutedNote.textContent = muted
      ? "Audio is muted by default in this build. Sound effects stay suppressed while muted."
      : "Audio mute is off and playback is enabled.";
  }
}

function updateAudioI2sUi() {
  const wsPin = Number(elements.audioWsPin?.value || state.settings?.audio?.wsPin || 0);
  const bclkPin = Number(elements.audioBclkPin?.value || state.settings?.audio?.bclkPin || 0);
  const doutPin = Number(elements.audioDoutPin?.value || state.settings?.audio?.doutPin || 0);

  if (elements.audioWsSummary) {
    elements.audioWsSummary.textContent = `GPIO${wsPin}`;
  }
  if (elements.audioBclkSummary) {
    elements.audioBclkSummary.textContent = `GPIO${bclkPin}`;
  }
  if (elements.audioDoutSummary) {
    elements.audioDoutSummary.textContent = `GPIO${doutPin}`;
  }
}

function oledPinsConflictWithAudio(payload) {
  const displayType = String(payload?.oled?.displayType || state.settings?.oled?.displayType || "oled").toLowerCase();
  const oledEnabled = Boolean(payload?.oled?.enabled ?? state.settings?.oled?.enabled ?? false);
  if (!oledEnabled || displayType === "wape") {
    return false;
  }

  const audioPins = new Set([
    Number(payload?.audio?.wsPin || state.settings?.audio?.wsPin || 0),
    Number(payload?.audio?.bclkPin || state.settings?.audio?.bclkPin || 0),
    Number(payload?.audio?.doutPin || state.settings?.audio?.doutPin || 0),
  ].filter((pin) => Number.isFinite(pin) && pin >= 0));

  const oledPins = [
    Number(payload?.oled?.sdaPin ?? state.settings?.oled?.sdaPin ?? -1),
    Number(payload?.oled?.sclPin ?? state.settings?.oled?.sclPin ?? -1),
    Number(payload?.oled?.resetPin ?? state.settings?.oled?.resetPin ?? -1),
  ].filter((pin) => Number.isFinite(pin) && pin >= 0);

  return oledPins.some((pin) => audioPins.has(pin));
}

function oledPinsConflictInternally(payload) {
  const displayType = String(payload?.oled?.displayType || state.settings?.oled?.displayType || "oled").toLowerCase();
  const oledEnabled = Boolean(payload?.oled?.enabled ?? state.settings?.oled?.enabled ?? false);
  if (!oledEnabled || displayType === "wape") {
    return false;
  }

  const sdaPin = Number(payload?.oled?.sdaPin ?? state.settings?.oled?.sdaPin ?? -1);
  const sclPin = Number(payload?.oled?.sclPin ?? state.settings?.oled?.sclPin ?? -1);
  const resetPin = Number(payload?.oled?.resetPin ?? state.settings?.oled?.resetPin ?? -1);

  if (sdaPin < 0 || sclPin < 0 || sdaPin === sclPin) {
    return true;
  }
  if (resetPin >= 0 && (resetPin === sdaPin || resetPin === sclPin)) {
    return true;
  }
  return false;
}

function updateLowBatterySleepUi() {
  const enabled = Boolean(elements.lowBatterySleepToggle?.checked);
  const threshold = Number(elements.lowBatterySleepThreshold?.value || state.settings?.device?.lowBatterySleepThresholdPercent || 20);
  if (elements.lowBatterySleepThresholdValue) {
    elements.lowBatterySleepThresholdValue.textContent = `${threshold}%`;
  }
  if (elements.lowBatterySleepThreshold) {
    elements.lowBatterySleepThreshold.disabled = !enabled;
  }
  if (elements.lowBatteryWakeIntervalMinutes) {
    elements.lowBatteryWakeIntervalMinutes.disabled = !enabled;
  }
}

function updateBatteryUi() {
  const adcPin = Number(elements.batteryAdcPin?.value || state.settings?.battery?.adcPin || 0);
  const exampleSuffix = ` Example Li-ion divider for GPIO${adcPin > 0 ? adcPin : 3}: BAT+ --- 220K - GPIO${adcPin > 0 ? adcPin : 3} - 220K ---- GND.`;
  if (elements.batteryPinSummary) {
    elements.batteryPinSummary.textContent = adcPin > 0 ? `GPIO${adcPin}` : "-";
  }
  if (elements.chargingSenseSummary) {
    const chargingState = state.status?.battery?.charging ? "Charging" : "Idle";
    elements.chargingSenseSummary.textContent = adcPin > 0 ? `GPIO${adcPin} trend • ${chargingState}` : chargingState;
  }
  if (elements.batteryNote) {
    elements.batteryNote.textContent = adcPin > 0
      ? `Measure the real voltage with a multimeter, enter it here, and save. The UI converts that value into the stored calibration multiplier using the live raw ADC voltage on GPIO${adcPin}.${exampleSuffix}`
      : `Measure the real voltage with a multimeter, enter it here, and save. The UI converts that value into the stored calibration multiplier using the live raw ADC voltage on the selected GPIO.${exampleSuffix}`;
  }
}

function currentBatteryCalibrationMultiplier() {
  const measuredVoltage = Number(elements.batteryMeasuredVoltage?.value || 0);
  const rawAdcVoltage = Number(state.status?.battery?.rawAdcVoltage || 0);
  const savedMultiplierField = elements.settingsForm.elements.namedItem("battery.calibrationMultiplier");
  const savedMultiplier = Number(savedMultiplierField?.value || 0);

  if (measuredVoltage > 0 && rawAdcVoltage > 0) {
    return measuredVoltage / rawAdcVoltage;
  }
  return savedMultiplier || Number(state.settings?.battery?.calibrationMultiplier || 0) || 2.0;
}

function updateDerivedBatteryCalibration() {
  if (!elements.batteryDerivedMultiplier) {
    return;
  }
  const rawAdcVoltage = Number(state.status?.battery?.rawAdcVoltage || 0);
  const measuredVoltage = Number(elements.batteryMeasuredVoltage?.value || 0);
  if (measuredVoltage > 0 && rawAdcVoltage > 0) {
    elements.batteryDerivedMultiplier.textContent = currentBatteryCalibrationMultiplier().toFixed(3);
    return;
  }
  const savedMultiplierField = elements.settingsForm.elements.namedItem("battery.calibrationMultiplier");
  const savedMultiplier = Number(savedMultiplierField?.value || 0);
  elements.batteryDerivedMultiplier.textContent = savedMultiplier > 0 ? savedMultiplier.toFixed(3) : "-";
}

function collectForm() {
  const payload = {};
  for (const field of elements.settingsForm.elements) {
    if (!field.name) {
      continue;
    }
    normalizeDecimalField(field);
    const [section, key] = field.name.split(".");
    payload[section] ||= {};
    payload[section][key] = field.type === "checkbox" ? field.checked : field.value;
  }

  payload.device ||= {};
  payload.audio ||= {};
  payload.mqtt ||= {};
  payload.battery ||= {};
  payload.oled ||= {};

  payload.mqtt.port = Number(payload.mqtt.port || 1883);
  payload.device.savedVolumePercent = Number(elements.volumeSlider?.value || payload.device.savedVolumePercent || 5);
  payload.device.statusLedPin = Number(elements.statusLedPin?.value || payload.device.statusLedPin || state.settings?.device?.statusLedPin || 0);
  payload.device.audioMuted = Boolean(elements.audioMutedToggle?.checked ?? payload.device.audioMuted ?? true);
  payload.device.lowBatterySleepThresholdPercent = Number(payload.device.lowBatterySleepThresholdPercent || 20);
  payload.device.lowBatteryWakeIntervalMinutes = Number(payload.device.lowBatteryWakeIntervalMinutes || 0);
  payload.audio.doutPin = Number(elements.audioDoutPin?.value || payload.audio.doutPin || DEFAULT_ESP32S3_AUDIO_PINS.dout);
  payload.audio.wsPin = Number(elements.audioWsPin?.value || payload.audio.wsPin || DEFAULT_ESP32S3_AUDIO_PINS.ws);
  payload.audio.bclkPin = Number(elements.audioBclkPin?.value || payload.audio.bclkPin || DEFAULT_ESP32S3_AUDIO_PINS.bclk);
  payload.battery.calibrationMultiplier = currentBatteryCalibrationMultiplier();
  payload.battery.updateIntervalMs = Number(payload.battery.updateIntervalMs || 10000);
  payload.battery.movingAverageWindowSize = Number(payload.battery.movingAverageWindowSize || 10);
  payload.oled.i2cAddress = Number(payload.oled.i2cAddress || 60);
  payload.oled.width = Number(payload.oled.width || 128);
  payload.oled.height = Number(payload.oled.height || 64);
  payload.oled.rotation = Number(payload.oled.rotation || 0);
  const preferredOledPins = choosePreferredOledPins(state.settings);
  payload.oled.sdaPin = Number(elements.oledSdaPin?.value || payload.oled.sdaPin || preferredOledPins.sda);
  payload.oled.sclPin = Number(elements.oledSclPin?.value || payload.oled.sclPin || preferredOledPins.scl);
  payload.oled.resetPin = Number(elements.oledResetPin?.value || payload.oled.resetPin || -1);
  payload.oled.dimTimeoutSeconds = Number(payload.oled.dimTimeoutSeconds || 0);
  payload.oled.wapeTriggerPin = Number(elements.wapeTriggerPin?.value || payload.oled.wapeTriggerPin || 0);
  payload.oled.displayType = String(elements.displayType?.value || payload.oled.displayType || "oled");
  payload.oled.wapeTriggerEvent = String(elements.wapeTriggerEvent?.value || payload.oled.wapeTriggerEvent || "play_start");
  return payload;
}

function updateConditionalVisibility() {
  const showStatic = elements.useStaticIpToggle.checked;
  for (const node of document.querySelectorAll(".static-ip-group")) {
    node.style.display = showStatic ? "grid" : "none";
  }
}

function queueSettingsSave(delayMs = SETTINGS_AUTOSAVE_DELAY_MS) {
  if (state.settingsLoading) {
    return;
  }
  state.settingsDirty = true;
  if (state.settingsSaveTimer) {
    window.clearTimeout(state.settingsSaveTimer);
  }
  state.settingsSaveTimer = window.setTimeout(() => {
    saveSettings({ silent: true }).catch(handleError);
  }, delayMs);
}

async function saveAudioPinMapping(options = {}) {
  const { silent = false } = options;
  if (!hasDistinctI2sPins()) {
    state.settingsDirty = true;
    if (!silent) {
      throw new Error("Pick three different GPIOs before saving the I2S mapping.");
    }
    return false;
  }

  if (state.settingsSaveTimer) {
    window.clearTimeout(state.settingsSaveTimer);
    state.settingsSaveTimer = null;
  }

  await waitForSettingsIdle();
  await saveSettings({ silent });
  return true;
}

function renderWifiNetworks(networks) {
  state.wifiSelectionPending = false;
  elements.wifiNetworkList.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = networks.length ? "Select a scanned SSID" : "No networks found";
  elements.wifiNetworkList.appendChild(placeholder);

  for (const network of networks) {
    if (!network.ssid) {
      continue;
    }

    const option = document.createElement("option");
    option.value = network.ssid;
    option.textContent = `${network.ssid} (${network.rssi} dBm${network.encrypted ? ", locked" : ", open"})`;
    elements.wifiNetworkList.appendChild(option);
  }
}

function resetWifiNetworkList(message = "Select a scanned SSID") {
  state.wifiSelectionPending = false;
  renderWifiNetworks([]);
  const placeholder = elements.wifiNetworkList.firstElementChild;
  if (placeholder) {
    placeholder.textContent = message;
  }
}

function renderRecentPlayback() {
  if (!state.recentPlayback.length) {
    elements.recentPlaybackList.innerHTML = '<div class="firmware-item"><div class="firmware-meta"><div class="firmware-title">No recent playback</div><div class="firmware-subtitle">Played URLs will appear here for one-click reuse.</div></div></div>';
    return;
  }

  elements.recentPlaybackList.innerHTML = state.recentPlayback.map((item, index) => `
    <div class="firmware-item">
      <div class="firmware-meta">
        <div class="firmware-title">${escapeHtml(normalizePlaybackTitle(item.label, item.url))}</div>
        <div class="firmware-subtitle">${escapeHtml(item.type)} | ${escapeHtml(item.url)}</div>
      </div>
      <button type="button" class="secondary recent-play-button" data-index="${index}">Use</button>
    </div>
  `).join("");

  for (const button of document.querySelectorAll(".recent-play-button")) {
    button.addEventListener("click", () => {
      const item = state.recentPlayback[Number(button.dataset.index)];
      document.getElementById("playUrl").value = item.url;
      document.getElementById("playLabel").value = item.label || "";
      document.getElementById("playType").value = item.type || "stream";
      toast("Loaded recent playback entry");
    });
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function estimateBatteryPercent(voltage) {
  const numericVoltage = Number(voltage || 0);
  if (!Number.isFinite(numericVoltage) || numericVoltage <= 0) {
    return 0;
  }
  const percent = Math.round(((numericVoltage - 3.2) / (4.2 - 3.2)) * 100);
  return Math.max(0, Math.min(100, percent));
}

function batteryLevelClass(percent) {
  if (percent >= 75) {
    return "high";
  }
  if (percent >= 45) {
    return "mid";
  }
  if (percent >= 20) {
    return "low";
  }
  return "critical";
}

function wifiSignalState(rssi, connected) {
  if (!connected) {
    return { level: 0, label: "Offline", tone: "weak" };
  }

  const numericRssi = Number(rssi || 0);
  if (numericRssi >= -55) {
    return { level: 4, label: "Excellent", tone: "excellent" };
  }
  if (numericRssi >= -67) {
    return { level: 3, label: "Good", tone: "good" };
  }
  if (numericRssi >= -75) {
    return { level: 2, label: "Fair", tone: "fair" };
  }
  return { level: 1, label: "Weak", tone: "weak" };
}

function renderBatteryHero(voltage) {
  if (!elements.batteryHero) {
    return;
  }

  const numericVoltage = Number(voltage || 0);
  const percent = estimateBatteryPercent(numericVoltage);
  const levelClass = batteryLevelClass(percent);
  const fillWidth = Math.max(8, percent);

  elements.batteryHero.className = "stat-value stat-value-battery";
  elements.batteryHero.innerHTML = `
    <div class="battery-hero-widget battery-${levelClass}" aria-label="Battery ${percent}%">
      <div class="battery-shell">
        <div class="battery-body">
          <div class="battery-fill" style="width: ${fillWidth}%;"></div>
          <div class="battery-percent">${percent}%</div>
        </div>
        <div class="battery-terminal"></div>
      </div>
      <div class="battery-meta">${numericVoltage.toFixed(2)} V</div>
    </div>
  `;
}

function renderWifiHero(connected, ipAddress, rssi) {
  if (!elements.wifiPill) {
    return;
  }

  const signal = wifiSignalState(rssi, connected);
  const bars = Array.from({ length: 4 }, (_, index) => {
    const active = index < signal.level;
    return `<span class="wifi-bar ${active ? `active ${signal.tone}` : ""}"></span>`;
  }).join("");

  elements.wifiPill.className = "stat-value stat-value-wifi";
  elements.wifiPill.innerHTML = connected
    ? `
      <div class="wifi-hero-widget wifi-${signal.tone}">
        <div class="wifi-icon" aria-hidden="true">${bars}</div>
        <div class="wifi-quality">${signal.label}</div>
        <div class="hero-meta hero-meta-compact">${escapeHtml(ipAddress || "No IP")} • ${Number(rssi || 0)} dBm</div>
      </div>
    `
    : `
      <div class="wifi-hero-widget wifi-weak">
        <div class="wifi-icon" aria-hidden="true">${bars}</div>
        <div class="wifi-quality">AP Mode</div>
        <div class="hero-meta hero-meta-compact">${escapeHtml(ipAddress || "No IP")}</div>
      </div>
    `;
}

function renderStatus(status) {
  state.status = status;
  populateStatusLedPinOptions();
  populateBatteryAdcPinOptions();
  populateWapeTriggerPinOptions();
  maybeRedirectToStationIp(status);
  const ota = status.otaManager || status.ota || {};
  const wifiConnected = Boolean(status.network.wifiConnected);
  const mqttConnected = Boolean(status.network.mqttConnected);
  const playbackActive = status.playback.state === "playing";
  const savedVolumePercent = Number(state.settings?.device?.savedVolumePercent ?? status.playback.volumePercent ?? 0);

  elements.deviceTitle.textContent = status.device.friendlyName || "ESP32 Notifier";
  elements.deviceNameValue.textContent = status.device.deviceName || "-";

  elements.ipAddress.textContent = status.network.ip || "-";
  elements.apInfo.textContent = status.network.apMode ? `${status.network.apSsid || "AP active"}` : "Disabled";
  elements.wifiRssi.textContent = wifiConnected ? `${status.network.wifiRssi} dBm` : "-";
  elements.mqttStatus.textContent = mqttConnected ? "Connected" : "Disconnected";
  elements.firmwareVersion.textContent = `${status.firmware.version} (${status.firmware.buildDate})`;
  elements.firmwareVersionCard.textContent = status.firmware.version;
  elements.batteryVoltage.textContent = `${Number(status.battery.voltage || 0).toFixed(3)} V`;
  elements.batteryRaw.textContent = `${status.battery.rawAdc ?? "-"} / ${Number(status.battery.rawAdcVoltage || 0).toFixed(3)} V`;
  updateDerivedBatteryCalibration();
  elements.freeHeap.textContent = `${status.system.freeHeap} B`;
  elements.settingsSource.textContent = status.settings.usingSaved ? "Saved settings" : "Hardwired defaults";
  elements.playbackState.textContent = status.playback.state || "idle";
  const currentTitle = normalizePlaybackTitle(status.playback.title, status.playback.url) || "Idle";
  elements.currentTitle.textContent = currentTitle;
  elements.currentTitle.title = currentTitle;
  elements.currentUrl.value = status.playback.url || "";
  elements.currentUrl.title = status.playback.url || "";
  if (document.activeElement !== elements.volumeSlider) {
    elements.volumeSlider.value = savedVolumePercent;
  }
  elements.volumeValue.textContent = `${document.activeElement === elements.volumeSlider ? elements.volumeSlider.value : savedVolumePercent}%`;
  const audioMuted = Boolean(elements.audioMutedToggle?.checked);
  const audioEnabled = Boolean(status.firmware?.audioEnabled);

  updatePlaybackActionButton();
  updateAudioUiState();

  renderWifiHero(wifiConnected, status.network.ip || (status.network.apMode ? "192.168.4.1" : "No IP"), status.network.wifiRssi);
  setPill(elements.mqttPill, mqttConnected ? "MQTT Connected" : "MQTT Offline", mqttConnected ? "ok" : "warn");
  setPill(elements.audioPill, audioMuted ? "Muted" : (status.playback.state || "idle"), playbackActive && !audioMuted ? "ok" : "warn");
  renderBatteryHero(status.battery.voltage || 0);

  elements.otaStatusLabel.textContent = ota.message || ota.lastResult || "Idle";
  elements.latestVersion.textContent = ota.latestVersion || status.ota.latestVersion || "-";
  elements.otaStatus.textContent = JSON.stringify({ ota, snapshot: status.ota }, null, 2);
  const progress = Number(ota.updateProgress || 0);
  const bytes = Number(ota.updateBytes || 0);
  const totalBytes = Number(ota.updateTotalBytes || 0);
  const phase = ota.updatePhase || "";
  elements.otaProgressFill.style.width = `${Math.max(0, Math.min(100, progress))}%`;
  if (ota.busy || progress > 0) {
    const byteLabel = totalBytes > 0 ? ` (${bytes}/${totalBytes} bytes)` : "";
    elements.otaProgressLabel.textContent = `${phase || "Update"} ${progress}%${byteLabel}`;
  } else {
    elements.otaProgressLabel.textContent = ota.updateAvailable ? "Update available" : "No pending update";
  }

  if (ota.busy) {
    startFirmwareProgressPolling();
  } else if (progress === 0) {
    stopFirmwareProgressPolling();
  }

  if (state.awaitingFirmwareReboot && !state.firmwareReloadPending) {
    const installed = status.ota?.lastResult === "installed" || /installed|restarting/i.test(String(ota.message || ""));
    if (installed) {
      beginFirmwareReconnectReload();
    }
  }

  if (state.mqttConnectInProgress) {
    if (state.mqttActionInProgress === "disconnect") {
      if (!mqttConnected) {
        setMqttConnectStatus("MQTT disconnected.");
      } else {
        setMqttConnectStatus("Disconnecting from MQTT broker...");
      }
    } else if (mqttConnected) {
      setMqttConnectStatus(`Connected to ${status.settings?.mqtt?.host || namedField("mqtt.host")?.value || "broker"}`);
    } else if (!wifiConnected) {
      setMqttConnectStatus("Waiting for Wi-Fi before MQTT can connect...");
    } else {
      setMqttConnectStatus("Connecting to MQTT broker...");
    }
  }

  if (state.wifiConnectInProgress) {
    if (wifiConnected) {
      setScanStatus(`Connected to ${status.network.ssid || namedField("wifi.ssid")?.value || "Wi-Fi"}`);
    } else {
      setScanStatus("Connecting to Wi-Fi...");
    }
  }

  updateWifiActionButton();
  updateMqttActionButton();
  populateButtonActionSelects();
  renderOledPreview();
}

function updateWifiActionButton() {
  if (!elements.scanWifiButton) {
    return;
  }

  const ssid = String(namedField("wifi.ssid")?.value || "").trim();
  const password = String(namedField("wifi.password")?.value || "").trim();
  const manualCredentialsReady = Boolean(ssid && password);
  const connectMode = state.wifiSelectionPending || manualCredentialsReady || state.wifiConnectInProgress;

  elements.scanWifiButton.textContent = connectMode ? "Connect" : "Scan Network";
  elements.scanWifiButton.classList.toggle("secondary", !connectMode);
}

function updateMqttActionButton() {
  if (!elements.mqttConnectButton) {
    return;
  }

  const mqttConnected = Boolean(state.status?.network?.mqttConnected);
  elements.mqttConnectButton.textContent = mqttConnected ? "Disconnect MQTT" : "Connect MQTT";
  elements.mqttConnectButton.classList.toggle("secondary", !mqttConnected);
}

function updatePlaybackActionButton() {
  if (!elements.playbackActionButton) {
    return;
  }

  const playbackActionInProgress = String(state.playbackActionInProgress || "");
  const playbackState = String(state.status?.playback?.state || "idle");
  const playbackActive = playbackState === "playing" || playbackState === "buffering";
  const audioEnabled = Boolean(state.status?.firmware?.audioEnabled);

  if (playbackActionInProgress === "play") {
    elements.playbackActionButton.textContent = "Starting...";
    elements.playbackActionButton.classList.remove("secondary");
    elements.playbackActionButton.disabled = true;
    elements.playbackActionButton.title = "Waiting for playback to start";
    return;
  }

  if (playbackActionInProgress === "stop") {
    elements.playbackActionButton.textContent = "Stopping...";
    elements.playbackActionButton.classList.add("secondary");
    elements.playbackActionButton.disabled = true;
    elements.playbackActionButton.title = "Waiting for playback to stop";
    return;
  }

  elements.playbackActionButton.textContent = playbackActive ? "Stop" : "Play";
  elements.playbackActionButton.classList.toggle("secondary", playbackActive);
  elements.playbackActionButton.disabled = !audioEnabled;
  elements.playbackActionButton.title = audioEnabled ? "" : "Audio playback is disabled in this firmware build";
}

function setupTabs() {
  const buttons = [...document.querySelectorAll(".tab-button")];
  const panels = [...document.querySelectorAll(".tab-panel")];
  const activateTab = (tabName) => {
    for (const button of buttons) {
      const isActive = button.dataset.tab === tabName;
      button.setAttribute("aria-selected", String(isActive));
    }
    for (const panel of panels) {
      panel.classList.toggle("active", panel.id === `tab-${tabName}`);
    }
    try {
      window.localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, tabName);
    } catch {
    }

    if (tabName === "firmware") {
      refreshFirmwareInfo(true).catch(handleError);
    }
  };

  for (const button of buttons) {
    button.addEventListener("click", () => {
      activateTab(button.dataset.tab);
    });
  }

  let initialTab = buttons[0]?.dataset.tab || "info";
  try {
    const savedTab = window.localStorage.getItem(ACTIVE_TAB_STORAGE_KEY);
    if (savedTab && buttons.some((button) => button.dataset.tab === savedTab)) {
      initialTab = savedTab;
    }
  } catch {
  }
  activateTab(initialTab);
}

function setupPasswordToggles() {
  for (const button of document.querySelectorAll(".password-toggle")) {
    button.addEventListener("click", () => {
      const field = elements.settingsForm.elements.namedItem(button.dataset.targetName);
      if (!field) {
        return;
      }
      const reveal = field.type === "password";
      field.type = reveal ? "text" : "password";
      button.classList.toggle("revealed", reveal);
    });
  }
}

async function loadStatus() {
  renderStatus(await request("/api/status"));
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

    elements.firmwareVersionCard.textContent = currentVersion;
    elements.latestVersion.textContent = latestVersion;
    elements.otaStatusLabel.textContent = info.updateStatus || "Idle";
    elements.otaStatus.textContent = JSON.stringify(info, null, 2);

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

function stopWifiScanPolling() {
  if (state.wifiScanPollTimer) {
    window.clearTimeout(state.wifiScanPollTimer);
    state.wifiScanPollTimer = null;
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

async function scanWifiNetworks() {
  const button = elements.scanWifiButton;
  const requestId = state.wifiScanRequestId + 1;
  state.wifiScanRequestId = requestId;
  stopWifiScanPolling();
  button.disabled = true;
  setScanStatus("Searching...");
  resetWifiNetworkList("Searching for networks...");

  try {
    const startResult = await request("/api/wifi/scan?start=1");
    if (!startResult.started && !startResult.scanning) {
      button.disabled = false;
      resetWifiNetworkList("No scan in progress");
      setScanStatus("Wi-Fi scan could not start", true);
      return;
    }

    const pollScan = async () => {
      try {
        if (state.wifiScanRequestId !== requestId) {
          return;
        }

        const result = await request("/api/wifi/scan");
        if (state.wifiScanRequestId !== requestId) {
          return;
        }

        if (result.scanning) {
          setScanStatus("Searching...");
          state.wifiScanPollTimer = window.setTimeout(() => {
            pollScan().catch(handleError);
          }, 800);
          return;
        }

        stopWifiScanPolling();
        button.disabled = false;

        if (result.failed) {
          resetWifiNetworkList("Wi-Fi scan failed");
          setScanStatus("Wi-Fi scan failed", true);
          return;
        }

        const networks = Array.isArray(result.networks) ? result.networks : [];
        renderWifiNetworks(networks);
        setScanStatus(networks.length ? `Found ${networks.length} network(s)` : "No networks found");
      } catch (error) {
        if (state.wifiScanRequestId !== requestId) {
          return;
        }
        stopWifiScanPolling();
        button.disabled = false;
        setScanStatus(error.message, true);
      }
    };

    await pollScan();
  } catch (error) {
    resetWifiNetworkList("Wi-Fi scan failed");
    setScanStatus(error.message, true);
    button.disabled = false;
    throw error;
  }
}

async function connectWifi() {
  const ssid = String(namedField("wifi.ssid")?.value || "").trim();
  if (!ssid) {
    setScanStatus("Select or enter a Wi-Fi SSID first", true);
    return;
  }

  state.wifiConnectInProgress = true;
  elements.scanWifiButton.disabled = true;
  setScanStatus(`Saving Wi-Fi settings for ${ssid}...`);

  try {
    if (state.settingsSaveTimer) {
      window.clearTimeout(state.settingsSaveTimer);
      state.settingsSaveTimer = null;
    }

    await waitForSettingsIdle();
    await saveSettings({ silent: true });
    setMessage(`Wi-Fi settings saved for ${ssid}`);
    setScanStatus(`Connecting to ${ssid}...`);

    const connected = await pollStatusUntil(
      (status) => Boolean(usableStationIp(status)),
      30,
      1000,
    );

    if (connected) {
      const stationIp = usableStationIp(state.status);
      setScanStatus(`Connected to ${state.status?.network?.ssid || ssid}${stationIp ? ` at ${stationIp}` : ""}`);
      setMessage(`Wi-Fi connected to ${state.status?.network?.ssid || ssid}${stationIp ? ` at ${stationIp}` : ""}`);
      maybeRedirectToStationIp(state.status, { force: true });
    } else {
      setScanStatus("Wi-Fi settings saved. Connection is still in progress.");
      setMessage("Wi-Fi settings saved. Waiting for connection.");
    }
  } finally {
    state.wifiConnectInProgress = false;
    elements.scanWifiButton.disabled = false;
    updateWifiActionButton();
  }
}

async function connectMqtt() {
  const mqttConnected = Boolean(state.status?.network?.mqttConnected);
  if (mqttConnected) {
    state.mqttConnectInProgress = true;
    state.mqttActionInProgress = "disconnect";
    elements.mqttConnectButton.disabled = true;
    setMqttConnectStatus("Disconnecting from MQTT broker...");

    try {
      await request("/api/mqtt", {
        method: "POST",
        body: JSON.stringify({ action: "disconnect" }),
      });

      const disconnected = await pollStatusUntil(
        (status) => !Boolean(status?.network?.mqttConnected),
        8,
        400,
      );

      if (disconnected) {
        setMqttConnectStatus("MQTT disconnected.");
        setMessage("MQTT disconnected");
      } else {
        setMqttConnectStatus("MQTT disconnect requested.");
        setMessage("MQTT disconnect requested");
      }
    } finally {
      state.mqttConnectInProgress = false;
      state.mqttActionInProgress = "";
      elements.mqttConnectButton.disabled = false;
      updateMqttActionButton();
    }
    return;
  }

  const host = String(namedField("mqtt.host")?.value || "").trim();
  if (!host) {
    setMqttConnectStatus("Enter an MQTT host first", true);
    return;
  }

  state.mqttConnectInProgress = true;
  state.mqttActionInProgress = "connect";
  elements.mqttConnectButton.disabled = true;
  setMqttConnectStatus(`Saving MQTT settings for ${host}...`);

  try {
    await saveSettings({ silent: true });
    setMessage(`MQTT settings saved for ${host}`);

    await request("/api/mqtt", {
      method: "POST",
      body: JSON.stringify({ action: "connect" }),
    });

    if (!state.status?.network?.wifiConnected) {
      setMqttConnectStatus("MQTT connect requested. Waiting for Wi-Fi first.");
      return;
    }

    setMqttConnectStatus(`Connecting to ${host}...`);
    const connected = await pollStatusUntil(
      (status) => Boolean(status?.network?.mqttConnected),
      15,
      1000,
    );

    if (connected) {
      setMqttConnectStatus(`Connected to ${host}`);
      setMessage(`MQTT connected to ${host}`);
    } else {
      setMqttConnectStatus("MQTT settings saved. Waiting for broker connection.");
      setMessage("MQTT settings saved. Waiting for broker connection.");
    }
  } finally {
    state.mqttConnectInProgress = false;
    state.mqttActionInProgress = "";
    elements.mqttConnectButton.disabled = false;
    updateMqttActionButton();
  }
}

async function loadSettings() {
  state.settings = await request("/api/settings");
  fillForm(state.settings);
  resetWifiNetworkList();
}

async function saveSettings(options = {}) {
  const { silent = false } = options;
  if (state.settingsLoading || state.settingsSaving) {
    return;
  }
  if (state.settingsSaveTimer) {
    window.clearTimeout(state.settingsSaveTimer);
    state.settingsSaveTimer = null;
  }
  normalizeDecimalField(elements.batteryMeasuredVoltage);
  state.settingsSaving = true;
  const submittedSettings = collectForm();
  if (oledPinsConflictInternally(submittedSettings)) {
    state.settingsSaving = false;
    throw new Error("OLED SDA, SCL, and RESET must use different GPIOs.");
  }
  if (oledPinsConflictWithAudio(submittedSettings)) {
    state.settingsSaving = false;
    throw new Error("OLED SDA, SCL, and RESET cannot reuse the active MAX98357A I2S pins. Change the display pins or disable OLED first.");
  }
  if (!silent) {
    setMessage("Saving settings...");
  }
  try {
    await request("/api/settings", {
      method: "POST",
      body: JSON.stringify(submittedSettings),
    });

    state.settings = submittedSettings;
    fillForm(submittedSettings);
    state.settingsDirty = false;
    setMessage(silent ? "Settings auto-saved" : "Settings saved");
    if (!silent) {
      toast("Settings saved");
    }

    await loadStatus();
    await refreshSettingsAfterSave(submittedSettings);
  } finally {
    state.settingsSaving = false;
  }
}

async function submitPlay(event) {
  if (event) {
    event.preventDefault();
  }
  state.playbackActionInProgress = "play";
  updatePlaybackActionButton();
  const payload = {
    url: elements.playUrl.value,
    label: normalizePlaybackTitle(elements.playLabel.value, elements.playUrl.value),
    type: elements.playType.value,
  };
  try {
    await request("/api/play", { method: "POST", body: JSON.stringify(payload) });
    state.recentPlayback.unshift(payload);
    state.recentPlayback = state.recentPlayback.filter((item, index, array) => index === array.findIndex((entry) => entry.url === item.url && entry.type === item.type));
    saveRecentPlayback();
    renderRecentPlayback();
    const started = await pollStatusUntil(
      (status) => {
        const playbackState = String(status?.playback?.state || "idle");
        return playbackState === "playing" || playbackState === "buffering";
      },
      12,
      150,
    );
    setMessage(started ? "Playback started" : "Playback queued");
    toast(started ? "Playback started" : "Playback queued");
    if (!started) {
      await loadStatus();
    }
  } finally {
    state.playbackActionInProgress = "";
    updatePlaybackActionButton();
  }
}

async function setVolume(volumePercent) {
  state.settings ||= {};
  state.settings.device ||= {};
  state.settings.device.savedVolumePercent = volumePercent;
  if (namedField("device.savedVolumePercent")) {
    namedField("device.savedVolumePercent").value = volumePercent;
  }
  await request("/api/volume", {
    method: "POST",
    body: JSON.stringify({ volumePercent }),
  });
  elements.volumeSlider.value = volumePercent;
  elements.volumeValue.textContent = `${volumePercent}%`;
  setMessage(`Volume saved at ${volumePercent}%`);
  await loadStatus();
  await refreshSettingsAfterSave({ device: { savedVolumePercent: volumePercent } }, 8, 200);
}

async function stopPlayback() {
  state.playbackActionInProgress = "stop";
  updatePlaybackActionButton();
  try {
    await request("/api/stop", { method: "POST", body: JSON.stringify({}) });
    const stopped = await pollStatusUntil(
      (status) => {
        const playbackState = String(status?.playback?.state || "idle");
        return playbackState !== "playing" && playbackState !== "buffering";
      },
      12,
      150,
    );
    setMessage(stopped ? "Playback stopped" : "Stop requested");
    toast(stopped ? "Playback stopped" : "Stop requested");
    if (!stopped) {
      await loadStatus();
    }
  } finally {
    state.playbackActionInProgress = "";
    updatePlaybackActionButton();
  }
}

async function handlePlaybackAction(event) {
  if (event) {
    event.preventDefault();
  }

  if (state.playbackActionInProgress) {
    return;
  }

  const playbackState = String(state.status?.playback?.state || "idle");
  const playbackActive = playbackState === "playing" || playbackState === "buffering";

  if (playbackActive) {
    await stopPlayback();
    return;
  }

  if (!elements.playForm.reportValidity()) {
    return;
  }

  await submitPlay();
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

async function postSimple(path, message) {
  await request(path, { method: "POST", body: JSON.stringify({}) });
  setMessage(message);
  toast(message);
}

async function copyCurrentUrl() {
  const value = elements.currentUrl.value;
  if (!value) {
    toast("No current URL to copy");
    return;
  }
  await navigator.clipboard.writeText(value);
  toast("Copied current URL");
}

async function triggerDisplay() {
  await postSimple("/api/display-trigger", "Display trigger queued");
}

elements.scanWifiButton.addEventListener("click", () => {
  const ssid = String(namedField("wifi.ssid")?.value || "").trim();
  const password = String(namedField("wifi.password")?.value || "").trim();
  const shouldConnect = state.wifiSelectionPending || Boolean(ssid && password);
  return (shouldConnect ? connectWifi() : scanWifiNetworks()).catch(handleError);
});
elements.playbackActionButton?.addEventListener("click", () => handlePlaybackAction().catch(handleError));
document.getElementById("copyUrlButton").addEventListener("click", () => copyCurrentUrl().catch(handleError));
document.getElementById("checkOtaButton").addEventListener("click", () => checkOta().catch(handleError));
document.getElementById("applyOtaButton").addEventListener("click", () => installSelectedFirmware().catch(handleError));
elements.mqttConnectButton?.addEventListener("click", () => connectMqtt().catch(handleError));
elements.displayTriggerButton?.addEventListener("click", () => triggerDisplay().catch(handleError));
elements.saveDeviceButton?.addEventListener("click", () => saveSettings({ silent: false }).catch(handleError));
document.getElementById("uploadFirmwareButton").addEventListener("click", () => {
  elements.localFirmwareFile.value = "";
  updateLocalFirmwareLabel();
  elements.localFirmwareFile.click();
});
document.getElementById("rebootButton").addEventListener("click", () => postSimple("/api/reboot", "Reboot requested").catch(handleError));
document.getElementById("factoryResetButton").addEventListener("click", async () => {
  if (!window.confirm("Erase saved settings and reboot?")) {
    return;
  }
  await postSimple("/api/factory-reset", "Factory reset requested");
});
elements.localFirmwareFile?.addEventListener("change", () => {
  updateLocalFirmwareLabel();
  if (elements.localFirmwareFile.files && elements.localFirmwareFile.files[0]) {
    uploadLocalFirmware().catch(handleError);
  }
});

elements.playForm.addEventListener("submit", (event) => handlePlaybackAction(event).catch(handleError));
elements.radioCountrySelect?.addEventListener("change", (event) => {
  loadRadioStations(event.target.value).catch(handleError);
});
elements.radioStationSelect?.addEventListener("change", () => {
  applySelectedRadioStation();
});
elements.wifiNetworkList.addEventListener("change", (event) => {
  if (!event.target.value) {
    state.wifiSelectionPending = false;
    updateWifiActionButton();
    return;
  }
  const field = namedField("wifi.ssid");
  if (field) {
    field.value = event.target.value;
    state.wifiSelectionPending = true;
    setScanStatus(`Selected ${event.target.value}. Enter the password, then connect.`);
    updateWifiActionButton();
  }
});
elements.volumeSlider.addEventListener("change", (event) => setVolume(Number(event.target.value)).catch(handleError));
elements.volumeSlider.addEventListener("input", (event) => {
  elements.volumeValue.textContent = `${event.target.value}%`;
});
elements.batteryAdcPin?.addEventListener("change", () => {
  populateOledPinOptions();
  populateWapeTriggerPinOptions();
  updateBatteryUi();
  queueSettingsSave(0);
});
for (const field of [elements.audioWsPin, elements.audioBclkPin, elements.audioDoutPin]) {
  field?.addEventListener("change", () => {
    updateAudioI2sUi();
    updateAudioUiState();
    populateBatteryAdcPinOptions();
    populateOledPinOptions();
    populateWapeTriggerPinOptions();
    updateBatteryUi();
    state.settingsDirty = true;
  });
}
elements.displayType?.addEventListener("change", () => {
  updateDisplayModeUi();
  populateOledPinOptions();
  populateWapeTriggerPinOptions();
  renderOledPreview();
});
for (const field of [elements.oledSdaPin, elements.oledSclPin, elements.oledResetPin]) {
  field?.addEventListener("change", () => {
    state.settingsDirty = true;
  });
}
elements.saveAudioButton?.addEventListener("click", () => saveAudioPinMapping({ silent: false }).catch(handleError));
elements.audioMutedToggle?.addEventListener("change", () => {
  updateAudioUiState();
  queueSettingsSave(150);
});
elements.lowBatterySleepToggle?.addEventListener("change", () => {
  updateLowBatterySleepUi();
  queueSettingsSave(150);
});
elements.lowBatterySleepThreshold?.addEventListener("input", () => {
  updateLowBatterySleepUi();
});
elements.batteryMeasuredVoltage?.addEventListener("input", (event) => {
  normalizeDecimalField(event.target);
  updateDerivedBatteryCalibration();
  queueSettingsSave();
});
elements.batteryMeasuredVoltage?.addEventListener("blur", (event) => {
  normalizeDecimalField(event.target);
  updateDerivedBatteryCalibration();
  if (state.settingsDirty) {
    saveSettings({ silent: true }).catch(handleError);
  }
});
elements.useStaticIpToggle.addEventListener("change", updateConditionalVisibility);

for (const field of elements.settingsForm.elements) {
  if (!field || !field.name) {
    continue;
  }

  if (field.name === "device.savedVolumePercent") {
    continue;
  }

  if (field.name === "audio.wsPin" || field.name === "audio.bclkPin" || field.name === "audio.doutPin") {
    continue;
  }

  if (field.name === "device.statusLedPin") {
    field.addEventListener("change", () => {
      populateOledPinOptions();
      populateBatteryAdcPinOptions();
      populateWapeTriggerPinOptions();
      updateBatteryUi();
      state.settingsDirty = true;
    });
    continue;
  }

  if (field.type === "checkbox" || field.tagName === "SELECT") {
    field.addEventListener("change", () => {
      queueSettingsSave(150);
      if (field.name === "wifi.ssid" || field.name === "wifi.password") {
        updateWifiActionButton();
      }
      if (field.name?.startsWith("device.lowBattery")) {
        updateLowBatterySleepUi();
      }
      if (field.name?.startsWith("oled.")) {
        renderOledPreview();
      }
      if (field.name?.startsWith("mqtt.")) {
        setMqttConnectStatus("");
      }
    });
    continue;
  }

  field.addEventListener("input", (event) => {
    normalizeDecimalField(event.target);
    if (event.target.name === "battery.calibrationMultiplier") {
      updateDerivedBatteryCalibration();
    }
    if (event.target.name === "wifi.ssid" || event.target.name === "wifi.password") {
      if (event.target.name === "wifi.ssid" && elements.wifiNetworkList) {
        const selectedNetwork = String(elements.wifiNetworkList.value || "").trim();
        const typedSsid = String(event.target.value || "").trim();
        if (!selectedNetwork || typedSsid !== selectedNetwork) {
          elements.wifiNetworkList.value = "";
          state.wifiSelectionPending = false;
        }
      }
      updateWifiActionButton();
      if (!state.wifiConnectInProgress) {
        setScanStatus("");
      }
    }
    if (event.target.name?.startsWith("device.lowBattery")) {
      updateLowBatterySleepUi();
    }
    if (event.target.name?.startsWith("oled.")) {
      renderOledPreview();
    }
    if (event.target.name?.startsWith("mqtt.")) {
      setMqttConnectStatus("");
    }
    queueSettingsSave();
  });

  field.addEventListener("blur", (event) => {
    normalizeDecimalField(event.target);
    if (state.settingsDirty) {
      saveSettings({ silent: true }).catch(handleError);
    }
  });
}

function handleError(error) {
  console.error(error);
  setMessage(error.message, true);
  toast(`Error: ${error.message}`);
}

setupTabs();
setupPasswordToggles();
renderRecentPlayback();
updateWifiActionButton();
populateButtonActionSelects();
renderOledPreview();
loadRadioCountries().catch(handleError);

Promise.all([loadStatus(), loadSettings()]).catch(handleError);

window.setInterval(() => {
  loadStatus().catch((error) => console.error(error));
}, 5000);
