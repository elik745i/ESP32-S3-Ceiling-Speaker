const state = {
  status: null,
  settings: null,
  storageInfoByTarget: {},
  currentStorageEntriesByTarget: { flash: [], sd: [] },
  currentStoragePathByTarget: { flash: "/", sd: "/" },
  currentStorageMetaByTarget: { flash: {}, sd: {} },
  activeStorageTarget: "flash",
  storageSelectionMode: false,
  storageSelectedPathsByTarget: { flash: [], sd: [] },
  storagePreviewItem: null,
  storagePreviewTarget: "flash",
  storagePreviewAudio: null,
  storagePreviewObjectUrl: "",
  storagePreviewArtworkUrl: "",
  storagePreviewRequestId: 0,
  storageListRequestId: 0,
  storagePreviewPlaybackMode: {
    deviceActive: false,
    previousDeviceActive: false,
    suppressAutoAdvance: false,
    loop: false,
    shuffle: false,
  },
  storageClickTimer: null,
  storageInitialLoadRequested: false,
  effectReindexInProgress: false,
  storageReindexInProgressByTarget: { flash: false, sd: false },
  headerActionsMenuOpen: false,
  rebootOverlayArmed: false,
  rebootOverlayTimer: null,
  rebootOverlayPollTimer: null,
  rebootOverlayCountdownRemaining: 0,
  rebootOverlayStartedAt: 0,
  rebootOverlayReconnectAllowedAt: 0,
  rebootOverlaySawDisconnect: false,
  effectFileOptions: [],
  effectFilesLoading: false,
  effectFileOptionsLoaded: false,
  effectFileOptionsCacheKey: "",
  batteryMeasuredVoltageInput: "",
  recentPlayback: loadRecentPlayback(),
  radioCountries: [],
  radioStations: [],
  radioCountriesLoading: false,
  radioStationsLoading: false,
  wifiScanPollTimer: null,
  firmwareProgressPollTimer: null,
  statusPollTimer: null,
  firmwareReloadTimer: null,
  statusRequestInFlight: false,
  settingsSaveTimer: null,
  settingsSavePromise: null,
  settingsDirty: false,
  settingsLoading: false,
  settingsSaving: false,
  wifiScanRequestId: 0,
  firmwareReleasesLoaded: false,
  firmwareReleasesLoading: false,
  firmwareReleases: [],
  firmwareLatestVersion: "",
  firmwareSelectedVersion: "",
  updatePopupShownVersion: "",
  deferredEffectsReload: false,
  deferredStorageReload: false,
  awaitingFirmwareReboot: false,
  firmwareReloadPending: false,
  wifiSelectionPending: false,
  wifiConnectInProgress: false,
  mqttConnectInProgress: false,
  mqttActionInProgress: "",
  playbackActionInProgress: "",
  storageUploadInProgress: false,
  stationRedirectInProgress: false,
  oledPreviewScrollTimer: null,
  oledPreviewScrollSignature: "",
  oledPreviewScrollOffset: 0,
};

const SETTINGS_AUTOSAVE_DELAY_MS = 900;
const ACTIVE_TAB_STORAGE_KEY = "notifierActiveTab";
const RADIO_SELECTION_STORAGE_KEY = "notifierRadioSelection";
const EFFECT_FILES_CACHE_STORAGE_KEY = "notifierEffectFilesCache";
const STORAGE_INITIAL_PAGE_SIZE = 20;
const STORAGE_SCROLL_PAGE_SIZE = 20;
const STORAGE_AUDIO_EXTENSIONS = new Set(["mp3", "wav", "aac", "m4a", "ogg", "opus", "flac"]);
const DEFAULT_RADIO_SELECTION = {
  country: "Azerbaijan",
  stationName: "AvtoFM",
  stationUrl: "",
};
const EFFECT_FILE_SOURCES = [
  { target: "sd", dir: "/media/wav", prefix: "SD" },
  { target: "flash", dir: "/wav", prefix: "Flash" },
];
const EFFECT_FILE_PAGE_SIZE = 20;
const EFFECT_SELECT_CONFIG = [
  { id: "effectStartupFile", field: "startupFile", label: "Startup" },
  { id: "effectAlarmFile", field: "alarmFile", label: "Alarm" },
  { id: "effectNotificationFile", field: "notificationFile", label: "Notification" },
  { id: "effectAmbientSoundFile", field: "ambientSoundFile", label: "Ambient Sound" },
  { id: "effectLowBatteryFile", field: "lowBatteryFile", label: "Low Battery" },
  { id: "effectShutDownFile", field: "shutDownFile", label: "Shut Down" },
  { id: "effectUpdateAvailableFile", field: "updateAvailableFile", label: "Updates Available" },
  { id: "effectUpdateSuccessFile", field: "updateSuccessFile", label: "Update Success" },
];
const STORAGE_PREVIEW_EMBEDDED_SCAN_MAX_BYTES = 256 * 1024;
const GPIO_BOARD_PRESENTATION = {
  "esp32-s3-super-mini": {
    rotation: "rotate(90deg)",
    rank: "Current board",
    recommendation: "Compact ESP32-S3 board. Good for speaker builds, but with tighter pin breakout than larger S3 boards.",
    tone: "featured",
  },
  "esp32-s3-zero": {
    rotation: "rotate(90deg)",
    rank: "Compact S3 option",
    recommendation: "Very small ESP32-S3 board. Good when you need S3 features in a minimal footprint.",
    tone: "good",
  },
  "esp32-s3-psram": {
    rotation: "none",
    rank: "S3 PSRAM variant",
    recommendation: "ESP32-S3-N16R8 layout with PSRAM and larger breakout coverage.",
    tone: "good",
  },
  "esp32-spk-n16r8": {
    rotation: "none",
    rank: "Speaker board variant",
    recommendation: "ESP32-S3 speaker/camera board with wide breakout access, onboard peripherals, and several already-committed pins.",
    tone: "warn",
  },
  "esp32-s3-devkit-c1": {
    rotation: "none",
    rank: "S3 DevKit variant",
    recommendation: "ESP32-S3 DevKit C-1 breakout with the N8R8-style pin arrangement.",
    tone: "good",
  },
  "esp32-s3-cam-module": {
    rotation: "none",
    rank: "S3 camera module",
    recommendation: "ESP32-S3-CAM module layout with the compact N16R8 module pin breakout.",
    tone: "warn",
  },
  "esp32-wrover": {
    rotation: "none",
    rank: "2. Very good",
    recommendation: "Strong classic ESP32 choice with PSRAM. A solid fallback when S3 boards are not available.",
    tone: "good",
  },
  "esp32-wroom": {
    rotation: "rotate(90deg)",
    rank: "3. Good",
    recommendation: "Good for speaker projects, but with less memory headroom than PSRAM-equipped boards.",
    tone: "good",
  },
  "esp32-mini": {
    rotation: "none",
    rank: "4. Compact fallback",
    recommendation: "Compact board for lighter builds. Works, but GPIO and memory headroom are tighter.",
    tone: "neutral",
  },
  "wemos-lolin32-mini": {
    rotation: "rotate(90deg)",
    rank: "ESP32 compact variant",
    recommendation: "Wemos Lolin32 Mini layout with the board-specific narrow pinout and VP/VN analog inputs.",
    tone: "neutral",
  },
  "esp32-s2-psram": {
    rotation: "none",
    rank: "5. Acceptable",
    recommendation: "Acceptable for simpler audio use, but it is not as strong as S3 or WROVER boards for this project.",
    tone: "neutral",
  },
  "esp32-c6": {
    rotation: "none",
    rank: "6. Works",
    recommendation: "Works, but it is not audio-focused. Choose it only if you specifically need the C6 platform.",
    tone: "neutral",
  },
  "esp32-c3": {
    rotation: "none",
    rank: "7. Basic only",
    recommendation: "ESP32-C3 Super Mini layout. Usable for simple builds, but still the most limited option here for speaker-oriented use.",
    tone: "basic",
  },
};
const GPIO_BOARD_ASSETS = {
  "esp32-s3-super-mini": {
    src: "/esp32-s3-supermini-breadboard.svg",
    alt: "ESP32-S3 Super Mini board",
  },
  "esp32-s3-zero": {
    src: "/esp32-s3-zero-breadboard.svg",
    alt: "ESP32-S3 Zero board",
  },
  "esp32-s3-psram": {
    src: "/esp32-s3-psram-breadboard.svg",
    alt: "ESP32-S3-N16R8 board",
  },
  "esp32-spk-n16r8": {
    src: "/esp32-spk-n16r8-breadboard.svg",
    alt: "ESP32-SPK-N16R8 board",
  },
  "esp32-s3-devkit-c1": {
    src: "/esp32-s3-devkit-c1-n8r8-v1-breadboard.svg",
    alt: "ESP32-S3 DevKit C-1 board",
  },
  "esp32-s3-cam-module": {
    src: "/esp32-s3-cam-module-breadboard.svg",
    alt: "ESP32-S3-CAM module board",
  },
  "esp32-wrover": {
    src: "/esp32-wrover-breadboard.svg",
    alt: "ESP32-WROVER board",
  },
  "esp32-wroom": {
    src: "/esp32-wroom-breadboard.svg",
    alt: "Classic ESP32-WROOM board",
  },
  "esp32-mini": {
    src: "/esp32-mini-breadboard.svg",
    alt: "ESP32 Mini board",
  },
  "wemos-lolin32-mini": {
    src: "/wemos-lolin32-mini-breadboard.svg",
    alt: "Wemos Lolin32 Mini board",
  },
  "esp32-s2-psram": {
    src: "/esp32-s2-mini-breadboard.svg",
    alt: "ESP32-S2 with PSRAM board",
  },
  "esp32-c6": {
    src: "/esp32-c6-mini-breadboard.svg",
    alt: "ESP32-C6 board",
  },
  "esp32-c3": {
    src: "/esp32-c3-breadboard.svg",
    alt: "ESP32-C3 Super Mini board",
  },
};
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
const DEFAULT_SD_GPIO_PINS = {
  cs: 4,
  sck: 5,
  mosi: 6,
  miso: 7,
};
const DOCUMENTED_BUZZER_PIN = 7;
const GPIO_BOARD_LAYOUTS = {
  "esp32-s3-super-mini": {
    left: [
      { pin: 43, label: "TX / GPIO43" },
      { pin: 44, label: "RX / GPIO44" },
      ...[1, 2, 3, 4, 5, 6, 7].map((pin) => ({ pin, label: `GPIO${pin}` })),
    ],
    right: [
      { pin: null, label: "5V" },
      { pin: null, label: "GND" },
      { pin: null, label: "3V3" },
      ...[13, 12, 11, 10, 9, 8].map((pin) => ({ pin, label: `GPIO${pin}` })),
    ],
  },
  "esp32-s3-zero": {
    left: [
      { pin: null, label: "5V" },
      { pin: null, label: "GND" },
      { pin: null, label: "3V3" },
      ...[1, 2, 3, 4, 5, 6].map((pin) => ({ pin, label: `GPIO${pin}` })),
    ],
    right: [
      { pin: 43, label: "TX / GPIO43" },
      { pin: 44, label: "RX / GPIO44" },
      ...[13, 12, 11, 10, 9, 8, 7, 16, 15, 14].map((pin) => ({ pin, label: `GPIO${pin}` })),
    ],
  },
  "esp32-s3-psram": {
    left: [
      { pin: null, label: "GND" },
      { pin: null, label: "3V3" },
      { pin: null, label: "EN" },
      ...[4, 5, 6, 7, 15, 16, 17, 18, 8, 19, 20, 3, 46, 9, 10, 11, 12].map((pin) => ({ pin, label: `GPIO${pin}` })),
      { pin: null, label: "3V3" },
    ],
    right: [
      { pin: null, label: "GND" },
      { pin: 1, label: "GPIO1" },
      { pin: 2, label: "GPIO2" },
      { pin: 43, label: "TX0 / GPIO43" },
      { pin: 44, label: "RX0 / GPIO44" },
      ...[42, 41, 40, 38, 37, 36, 35, 0, 45, 48, 47, 21, 14, 13].map((pin) => ({ pin, label: `GPIO${pin}` })),
      { pin: null, label: "5V IN" },
    ],
  },
  "esp32-spk-n16r8": {
    left: [
      { pin: null, label: "5V" },
      { pin: null, label: "GND" },
      { pin: null, label: "3.3V" },
      { pin: null, label: "GND" },
      ...[20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6].map((pin) => ({ pin, label: `GPIO${pin}` })),
    ],
    right: [
      { pin: null, label: "5V" },
      { pin: null, label: "GND" },
      { pin: null, label: "3.3V" },
      { pin: null, label: "GND" },
      { pin: null, label: "NC" },
      { pin: null, label: "NC" },
      { pin: 21, label: "GPIO21" },
      { pin: 38, label: "GPIO38" },
      { pin: 39, label: "GPIO39" },
      { pin: 40, label: "GPIO40" },
      { pin: 43, label: "GPIO43" },
      { pin: 44, label: "GPIO44" },
      { pin: 46, label: "GPIO46" },
      { pin: 0, label: "GPIO0" },
      { pin: 2, label: "GPIO2" },
      { pin: null, label: "EN" },
      { pin: 1, label: "GPIO1" },
      { pin: 3, label: "GPIO3" },
    ],
  },
  "esp32-s3-devkit-c1": {
    left: [
      { pin: null, label: "3V3" },
      { pin: null, label: "3V3" },
      { pin: null, label: "RST" },
      ...[4, 5, 6, 7, 15, 16, 17, 18, 8, 3, 46, 9, 10, 11, 12, 13, 14].map((pin) => ({ pin, label: `GPIO${pin}` })),
      { pin: null, label: "5V" },
      { pin: null, label: "GND" },
    ],
    right: [
      { pin: null, label: "GND" },
      { pin: 43, label: "TX / GPIO43" },
      { pin: 44, label: "RX / GPIO44" },
      { pin: 1, label: "GPIO1" },
      { pin: 2, label: "GPIO2" },
      ...[42, 41, 40, 39, 38, 37, 36, 35, 0, 45, 48, 47, 21, 20, 19].map((pin) => ({ pin, label: `GPIO${pin}` })),
      { pin: null, label: "GND" },
      { pin: null, label: "GND" },
    ],
  },
  "esp32-s3-cam-module": {
    left: [
      { pin: null, label: "3V3" },
      { pin: null, label: "RST" },
      ...[4, 5, 6, 7, 15, 16, 17, 18, 8, 3, 46, 9, 10, 11, 12, 13, 14].map((pin) => ({ pin, label: `GPIO${pin}` })),
      { pin: null, label: "5V" },
    ],
    right: [
      { pin: 43, label: "TX / GPIO43" },
      { pin: 44, label: "RX / GPIO44" },
      { pin: 1, label: "GPIO1" },
      { pin: 2, label: "GPIO2" },
      ...[42, 41, 40, 39, 38, 37, 36, 35, 0, 45, 48, 47, 21, 20, 19].map((pin) => ({ pin, label: `GPIO${pin}` })),
      { pin: null, label: "GND" },
    ],
  },
  "esp32-wrover": {
    left: [36, 39, 34, 35, 32, 33, 25, 26, 27, 14, 12, 13].map((pin) => ({ pin, label: `GPIO${pin}` })),
    right: [23, 22, 1, 3, 21, 19, 18, 5, 17, 16, 4, 0, 2, 15].map((pin) => ({
      pin,
      label: pin === 1 ? "TX / GPIO1" : (pin === 3 ? "RX / GPIO3" : `GPIO${pin}`),
    })),
  },
  "esp32-wroom": {
    left: [36, 39, 34, 35, 32, 33, 25, 26, 27, 14, 12, 13].map((pin) => ({ pin, label: `GPIO${pin}` })),
    right: [23, 22, 1, 3, 21, 19, 18, 5, 17, 16, 4, 0, 2, 15].map((pin) => ({
      pin,
      label: pin === 1 ? "TX / GPIO1" : (pin === 3 ? "RX / GPIO3" : `GPIO${pin}`),
    })),
  },
  "esp32-mini": {
    left: [
      { pin: null, label: "RST" },
      { pin: null, label: "A0" },
      { pin: 16, label: "D0 / GPIO16" },
      { pin: 14, label: "D5 / GPIO14" },
      { pin: 12, label: "D6 / GPIO12" },
      { pin: 13, label: "D7 / GPIO13" },
      { pin: 15, label: "D8 / GPIO15" },
      { pin: null, label: "3V3" },
    ],
    right: [
      { pin: 1, label: "TX / GPIO1" },
      { pin: 3, label: "RX / GPIO3" },
      { pin: 5, label: "D1 / GPIO5" },
      { pin: 4, label: "D2 / GPIO4" },
      { pin: 0, label: "D3 / GPIO0" },
      { pin: 2, label: "D4 / GPIO2" },
      { pin: null, label: "GND" },
      { pin: null, label: "5V" },
    ],
  },
  "wemos-lolin32-mini": {
    left: [
      { pin: 36, label: "VP / GPIO36" },
      { pin: 39, label: "VN / GPIO39" },
      { pin: null, label: "EN" },
      ...[34, 35, 32, 33, 25, 26, 27, 14, 12].map((pin) => ({ pin, label: `GPIO${pin}` })),
      { pin: null, label: "GND" },
    ],
    right: [
      { pin: null, label: "3V3" },
      ...[22, 19, 23, 18, 5, 7, 6, 4, 0, 2, 15, 13].map((pin) => ({ pin, label: `GPIO${pin}` })),
    ],
  },
  "esp32-s2-psram": {
    left: [
      { pin: 1, label: "GPIO1" },
      { pin: null, label: "EN" },
      { pin: 2, label: "GPIO2" },
      { pin: 3, label: "GPIO3" },
      { pin: 4, label: "GPIO4" },
      { pin: 5, label: "GPIO5" },
      { pin: 6, label: "GPIO6" },
      { pin: 7, label: "GPIO7" },
      { pin: 8, label: "GPIO8" },
      { pin: 9, label: "GPIO9" },
      { pin: 10, label: "GPIO10" },
      { pin: 11, label: "GPIO11" },
      { pin: 13, label: "GPIO13" },
      { pin: 12, label: "GPIO12" },
      { pin: 14, label: "GPIO14" },
      { pin: null, label: "3.3V" },
    ],
    right: [
      { pin: 39, label: "GPIO39" },
      { pin: 40, label: "GPIO40" },
      { pin: 37, label: "GPIO37" },
      { pin: 38, label: "GPIO38" },
      { pin: 35, label: "GPIO35" },
      { pin: 36, label: "GPIO36" },
      { pin: 33, label: "GPIO33" },
      { pin: 34, label: "GPIO34" },
      { pin: 18, label: "GPIO18" },
      { pin: 21, label: "GPIO21" },
      { pin: 16, label: "GPIO16" },
      { pin: 17, label: "GPIO17" },
      { pin: null, label: "GND" },
      { pin: null, label: "GND" },
      { pin: null, label: "VBUS" },
      { pin: 15, label: "GPIO15" },
    ],
  },
  "esp32-c6": {
    left: [
      { pin: 16, label: "TX / GPIO16" },
      { pin: 17, label: "RX / GPIO17" },
      ...[0, 1, 2, 3, 4, 5, 6, 7].map((pin) => ({ pin, label: `GPIO${pin}` })),
    ],
    right: [
      { pin: null, label: "5V" },
      { pin: null, label: "GND" },
      { pin: null, label: "3.3V" },
      ...[20, 19, 18, 15, 14, 9, 8].map((pin) => ({ pin, label: `GPIO${pin}` })),
    ],
  },
  "esp32-c3": {
    left: [21, 20, 10, 9, 8, 7, 6, 5].map((pin) => ({
      pin,
      label: `GPIO${pin}`,
    })),
    right: [
      { pin: 0, label: "GPIO0" },
      { pin: 1, label: "GPIO1" },
      { pin: 2, label: "GPIO2" },
      { pin: 3, label: "GPIO3" },
      { pin: 4, label: "GPIO4" },
      { pin: null, label: "3.3V" },
      { pin: null, label: "GND" },
      { pin: null, label: "5V" },
    ],
  },
};
const GPIO_BOARD_EXTRA_LAYOUTS = {
  "esp32-s3-super-mini": {
    left: [48, 47, 46, 45, 42, 41, 40, 39].map((pin) => ({ pin, label: `GPIO${pin}` })),
    right: [34, 33, 21, 18, 17, 16, 15, 14].map((pin) => ({ pin, label: `GPIO${pin}` })),
  },
  "esp32-s3-zero": {
    left: [39, 40, 41, 42, 43, 44, 45, 46, 47, 48].map((pin) => ({ pin, label: `GPIO${pin}` })),
    right: [38, 37, 36, 35, 34, 33, 18, 17].map((pin) => ({ pin, label: `GPIO${pin}` })),
  },
  "esp32-c6": {
    left: [15, 8, 23].map((pin) => ({ pin, label: `GPIO${pin}` })),
    right: [12, 13, 21, 22].map((pin) => ({ pin, label: `GPIO${pin}` })),
  },
};
const GPIO_BOARD_RESERVED_PINS = {
  "esp32-c6": {
    8: { label: "WS2812", warning: "Reserved onboard LED pin: GPIO8 drives the built-in WS2812 RGB LED (DIN).", kind: "onboard" },
    9: { label: "BOOT", warning: "Reserved strap pin: GPIO9 is tied to the BOOT function on this ESP32-C6 board.", kind: "strap" },
    15: { label: "LED", warning: "Board-tied LED pin: GPIO15 drives the onboard LED on this ESP32-C6 board.", kind: "onboard" },
  },
  "esp32-s2-psram": {
    15: { label: "LED", warning: "Board-tied LED pin: GPIO15 drives the onboard LED on this ESP32-S2 PSRAM board.", kind: "onboard" },
    34: { label: "SPI CS", warning: "Reserved SPI/PSRAM pin: GPIO34 is tied to the onboard CS signal on this board.", kind: "psram" },
    35: { label: "SPI MOSI", warning: "Reserved SPI/PSRAM pin: GPIO35 is tied to the onboard MOSI signal on this board.", kind: "psram" },
    36: { label: "SPI SCK", warning: "Reserved SPI/PSRAM pin: GPIO36 is tied to the onboard clock signal on this board.", kind: "psram" },
    37: { label: "SPI MISO", warning: "Reserved SPI/PSRAM pin: GPIO37 is tied to the onboard MISO signal on this board.", kind: "psram" },
    39: { label: "JTAG MTCK", warning: "Board-tied JTAG pin: GPIO39 is routed to MTCK on this ESP32-S2 board.", kind: "jtag" },
    40: { label: "JTAG MTDO", warning: "Board-tied JTAG pin: GPIO40 is routed to MTDO on this ESP32-S2 board.", kind: "jtag" },
  },
  "esp32-s3-cam-module": {
    0: { label: "BOOT", warning: "Reserved strap pin: GPIO0 is used for BOOT mode.", kind: "strap" },
    2: { label: "LED ON", warning: "Board-tied LED pin: GPIO2 drives the onboard LED.", kind: "onboard" },
    3: { label: "JTAG EN", warning: "Reserved strap pin: GPIO3 is used for JTAG enable/strap behavior on this module.", kind: "strap" },
    4: { label: "CAM SIOD", warning: "Reserved camera pin: GPIO4 is used for camera SIOD.", kind: "camera" },
    5: { label: "CAM SIOC", warning: "Reserved camera pin: GPIO5 is used for camera SIOC.", kind: "camera" },
    6: { label: "CAM VSYNC", warning: "Reserved camera pin: GPIO6 is used for camera VSYNC.", kind: "camera" },
    7: { label: "CAM HREF", warning: "Reserved camera pin: GPIO7 is used for camera HREF.", kind: "camera" },
    8: { label: "CAM Y4", warning: "Reserved camera pin: GPIO8 is used for camera Y4.", kind: "camera" },
    9: { label: "CAM Y3", warning: "Reserved camera pin: GPIO9 is used for camera Y3.", kind: "camera" },
    10: { label: "CAM Y5", warning: "Reserved camera pin: GPIO10 is used for camera Y5.", kind: "camera" },
    11: { label: "CAM Y2", warning: "Reserved camera pin: GPIO11 is used for camera Y2.", kind: "camera" },
    12: { label: "CAM Y6", warning: "Reserved camera pin: GPIO12 is used for camera Y6.", kind: "camera" },
    13: { label: "CAM PCLK", warning: "Reserved camera pin: GPIO13 is used for camera PCLK.", kind: "camera" },
    15: { label: "CAM XCLK", warning: "Reserved camera pin: GPIO15 is used for camera XCLK.", kind: "camera" },
    16: { label: "CAM Y9", warning: "Reserved camera pin: GPIO16 is used for camera Y9.", kind: "camera" },
    17: { label: "CAM Y8", warning: "Reserved camera pin: GPIO17 is used for camera Y8.", kind: "camera" },
    18: { label: "CAM Y7", warning: "Reserved camera pin: GPIO18 is used for camera Y7.", kind: "camera" },
    19: { label: "USB D+", warning: "Board-tied USB pin: GPIO19 is used for USB D+ and auxiliary serial functions.", kind: "usb" },
    20: { label: "USB D-", warning: "Board-tied USB pin: GPIO20 is used for USB D- and auxiliary serial functions.", kind: "usb" },
    35: { label: "PSRAM", warning: "Reserved PSRAM pin: GPIO35 is used for onboard PSRAM.", kind: "psram" },
    36: { label: "PSRAM", warning: "Reserved PSRAM pin: GPIO36 is used for onboard PSRAM.", kind: "psram" },
    37: { label: "PSRAM", warning: "Reserved PSRAM pin: GPIO37 is used for onboard PSRAM.", kind: "psram" },
    38: { label: "SD CMD", warning: "Reserved SD pin: GPIO38 is used for the built-in SD CMD line.", kind: "sd" },
    39: { label: "SD CLK", warning: "Reserved SD pin: GPIO39 is used for the built-in SD clock line.", kind: "sd" },
    40: { label: "SD DATA", warning: "Reserved SD pin: GPIO40 is used for built-in SD data.", kind: "sd" },
    41: { label: "MTDI", warning: "Board-tied JTAG pin: GPIO41 is routed to MTDI.", kind: "jtag" },
    42: { label: "MTMS", warning: "Board-tied JTAG pin: GPIO42 is routed to MTMS.", kind: "jtag" },
    43: { label: "U0TXD / LED TX", warning: "Board-tied serial pin: GPIO43 is used for U0TXD and the onboard TX LED.", kind: "serial" },
    44: { label: "U0RXD / LED RX", warning: "Board-tied serial pin: GPIO44 is used for U0RXD and the onboard RX LED.", kind: "serial" },
    45: { label: "VSPI", warning: "Reserved strap pin: GPIO45 is used for VSPI/boot strap behavior.", kind: "strap" },
    46: { label: "LOG", warning: "Reserved strap pin: GPIO46 is used for LOG/strap behavior.", kind: "strap" },
    48: { label: "WS2812", warning: "Reserved onboard LED pin: GPIO48 drives the built-in WS2812 status LED.", kind: "onboard" },
  },
  "esp32-spk-n16r8": {
    0: { label: "BOOT", warning: "Reserved strap pin: GPIO0 is tied to BOOT mode behavior on this speaker board.", kind: "strap" },
    1: { label: "U0TXD", warning: "Board-tied serial pin: GPIO1 is routed to the primary UART on this board.", kind: "serial" },
    2: { label: "STRAP", warning: "Reserved strap pin: GPIO2 participates in boot strapping on this speaker board.", kind: "strap" },
    3: { label: "U0RXD", warning: "Board-tied serial pin: GPIO3 is routed to the primary UART on this board.", kind: "serial" },
    19: { label: "USB D+", warning: "Board-tied USB pin: GPIO19 is used for USB D+ on this ESP32-SPK-N16R8 board.", kind: "usb" },
    20: { label: "USB D-", warning: "Board-tied USB pin: GPIO20 is used for USB D- on this ESP32-SPK-N16R8 board.", kind: "usb" },
    38: { label: "CAM/SD", warning: "Reserved board pin: GPIO38 is committed to onboard camera or storage routing on this board.", kind: "camera" },
    39: { label: "CAM/SD", warning: "Reserved board pin: GPIO39 is committed to onboard camera or storage routing on this board.", kind: "camera" },
    40: { label: "CAM/SD", warning: "Reserved board pin: GPIO40 is committed to onboard camera or storage routing on this board.", kind: "camera" },
    43: { label: "U0TXD / LED TX", warning: "Board-tied serial pin: GPIO43 is routed to U0TXD and board serial activity.", kind: "serial" },
    44: { label: "U0RXD / LED RX", warning: "Board-tied serial pin: GPIO44 is routed to U0RXD and board serial activity.", kind: "serial" },
    46: { label: "LOG", warning: "Reserved strap pin: GPIO46 is tied to strap/log behavior on this board.", kind: "strap" },
  },
};
const GPIO_ROLE_OPTIONS = [
  "Unused",
  "Battery ADC",
  "Charge Sense",
  "Status LED",
  "Button 1",
  "Button 2",
  "I2S DIN",
  "I2S WS",
  "I2S BCLK",
  "OLED SDA",
  "OLED SCL",
  "OLED RESET",
  "Wape Trigger",
  "SD CS",
  "SD SCK",
  "SD MOSI",
  "SD MISO",
  "Builtin RGB",
  "Buzzer Reserved",
];
const WS_STATUS_LED_BOARD_PROFILES = new Set(["esp32-s3-super-mini", "esp32-s3-zero"]);

const elements = {
  deviceTitle: document.getElementById("deviceTitle"),
  heroFirmwareVersion: document.getElementById("heroFirmwareVersion"),
  heroFirmwareChannel: document.getElementById("heroFirmwareChannel"),
  heroFirmwareAuthorLink: document.getElementById("heroFirmwareAuthorLink"),
  gpioBoardRecommendations: document.getElementById("gpioBoardRecommendations"),
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
  effectStartupFile: document.getElementById("effectStartupFile"),
  effectAlarmFile: document.getElementById("effectAlarmFile"),
  effectNotificationFile: document.getElementById("effectNotificationFile"),
  effectAmbientSoundFile: document.getElementById("effectAmbientSoundFile"),
  effectLowBatteryFile: document.getElementById("effectLowBatteryFile"),
  effectShutDownFile: document.getElementById("effectShutDownFile"),
  effectUpdateAvailableFile: document.getElementById("effectUpdateAvailableFile"),
  effectUpdateSuccessFile: document.getElementById("effectUpdateSuccessFile"),
  effectsFileStatus: document.getElementById("effectsFileStatus"),
  audioWsSummary: document.getElementById("audioWsSummary"),
  audioBclkSummary: document.getElementById("audioBclkSummary"),
  audioDoutSummary: document.getElementById("audioDoutSummary"),
  saveAudioButton: document.getElementById("saveAudioButton"),
  batteryHero: document.getElementById("batteryHero"),
  freeHeap: document.getElementById("freeHeap"),
  deviceHardwareBoard: document.getElementById("deviceHardwareBoard"),
  deviceHardwareCpu: document.getElementById("deviceHardwareCpu"),
  deviceHardwareFlash: document.getElementById("deviceHardwareFlash"),
  deviceHardwareAudio: document.getElementById("deviceHardwareAudio"),
  deviceHardwareDisplay: document.getElementById("deviceHardwareDisplay"),
  deviceHardwareBattery: document.getElementById("deviceHardwareBattery"),
  deviceHardwareSd: document.getElementById("deviceHardwareSd"),
  deviceCpuLoadValue: document.getElementById("deviceCpuLoadValue"),
  deviceCpuLoadBar: document.getElementById("deviceCpuLoadBar"),
  deviceCpuLoadMeta: document.getElementById("deviceCpuLoadMeta"),
  deviceSramValue: document.getElementById("deviceSramValue"),
  deviceSramBar: document.getElementById("deviceSramBar"),
  deviceSramMeta: document.getElementById("deviceSramMeta"),
  devicePsramValue: document.getElementById("devicePsramValue"),
  devicePsramBar: document.getElementById("devicePsramBar"),
  devicePsramMeta: document.getElementById("devicePsramMeta"),
  deviceSpiffsValue: document.getElementById("deviceSpiffsValue"),
  deviceSpiffsBar: document.getElementById("deviceSpiffsBar"),
  deviceSpiffsMeta: document.getElementById("deviceSpiffsMeta"),
  deviceSpiffsCard: document.getElementById("deviceSpiffsCard"),
  deviceSdValue: document.getElementById("deviceSdValue"),
  deviceSdBar: document.getElementById("deviceSdBar"),
  deviceSdMeta: document.getElementById("deviceSdMeta"),
  deviceSdCard: document.getElementById("deviceSdCard"),
  gpioLeftPins: document.getElementById("gpioLeftPins"),
  gpioRightPins: document.getElementById("gpioRightPins"),
  gpioExtraSection: document.getElementById("gpioExtraSection"),
  gpioExtraToggle: document.getElementById("gpioExtraToggle"),
  gpioExtraPanel: document.getElementById("gpioExtraPanel"),
  gpioExtraLeftPins: document.getElementById("gpioExtraLeftPins"),
  gpioExtraRightPins: document.getElementById("gpioExtraRightPins"),
  gpioBoardAutodetect: document.getElementById("gpioBoardAutodetect"),
  settingsSource: document.getElementById("settingsSource"),
  playbackState: document.getElementById("playbackState"),
  currentTitle: document.getElementById("currentTitle"),
  currentUrl: document.getElementById("currentUrl"),
  wifiPill: document.getElementById("wifiPill"),
  mqttPill: document.getElementById("mqttPill"),
  audioPill: document.getElementById("audioPill"),
  audioPillState: document.getElementById("audioPillState"),
  audioPillTitle: document.getElementById("audioPillTitle"),
  playbackPrevButton: document.getElementById("playbackPrevButton"),
  playbackHeroToggleButton: document.getElementById("playbackHeroToggleButton"),
  playbackNextButton: document.getElementById("playbackNextButton"),
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
  effectsReindexButton: document.getElementById("effectsReindexButton"),
  headerActionsButton: document.getElementById("headerActionsButton"),
  headerActionsMenu: document.getElementById("headerActionsMenu"),
  headerRefreshButton: document.getElementById("headerRefreshButton"),
  headerRebootButton: document.getElementById("headerRebootButton"),
  headerShutdownButton: document.getElementById("headerShutdownButton"),
  rebootOverlay: document.getElementById("rebootOverlay"),
  rebootOverlayProgress: document.getElementById("rebootOverlayProgress"),
  rebootOverlayCountdown: document.getElementById("rebootOverlayCountdown"),
  rebootOverlayTitle: document.getElementById("rebootOverlayTitle"),
  rebootOverlayStatus: document.getElementById("rebootOverlayStatus"),
  updateAvailableDialog: document.getElementById("updateAvailableDialog"),
  updateAvailableBody: document.getElementById("updateAvailableBody"),
  updateAvailableCloseButton: document.getElementById("updateAvailableCloseButton"),
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
  gpioBoardSelector: document.getElementById("gpioBoardSelector"),
  gpioBoardImage: document.getElementById("gpioBoardImage"),
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
  storageModal: document.getElementById("storageModal"),
  storageCloseButton: document.getElementById("storageCloseButton"),
  storageTitle: document.getElementById("storageTitle"),
  storageFlashButton: document.getElementById("storageFlashButton"),
  storageSdButton: document.getElementById("storageSdButton"),
  storageSdConfig: document.getElementById("storageSdConfig"),
  storageSummary: document.getElementById("storageSummary"),
  storageStatus: document.getElementById("storageStatus"),
  storageLimit: document.getElementById("storageLimit"),
  storageUpButton: document.getElementById("storageUpButton"),
  storageBreadcrumbs: document.getElementById("storageBreadcrumbs"),
  storageNewFolderButton: document.getElementById("storageNewFolderButton"),
  storageReindexButton: document.getElementById("storageReindexButton"),
  storageSelectModeButton: document.getElementById("storageSelectModeButton"),
  storageSelectAllButton: document.getElementById("storageSelectAllButton"),
  storageDeleteButton: document.getElementById("storageDeleteButton"),
  storagePlayButton: document.getElementById("storagePlayButton"),
  storageUploadButton: document.getElementById("storageUploadButton"),
  storageFileInput: document.getElementById("storageFileInput"),
  storageProgressFill: document.getElementById("storageProgressFill"),
  storageProgressLabel: document.getElementById("storageProgressLabel"),
  storageFileList: document.getElementById("storageFileList"),
  storagePreviewModal: document.getElementById("storagePreviewModal"),
  storagePreviewCloseButton: document.getElementById("storagePreviewCloseButton"),
  storagePreviewTitle: document.getElementById("storagePreviewTitle"),
  storagePreviewMeta: document.getElementById("storagePreviewMeta"),
  storagePreviewPath: document.getElementById("storagePreviewPath"),
  storagePreviewAlbum: document.getElementById("storagePreviewAlbum"),
  storagePreviewArtwork: document.getElementById("storagePreviewArtwork"),
  storagePreviewArtworkFallback: document.getElementById("storagePreviewArtworkFallback"),
  storagePreviewArtworkStatus: document.getElementById("storagePreviewArtworkStatus"),
  storagePreviewProgressFill: document.getElementById("storagePreviewProgressFill"),
  storagePreviewProgressLabel: document.getElementById("storagePreviewProgressLabel"),
  storagePreviewVolumeSlider: document.getElementById("storagePreviewVolumeSlider"),
  storagePreviewVolumeValue: document.getElementById("storagePreviewVolumeValue"),
  storagePreviewPrevButton: document.getElementById("storagePreviewPrevButton"),
  storagePreviewPlayButton: document.getElementById("storagePreviewPlayButton"),
  storagePreviewNextButton: document.getElementById("storagePreviewNextButton"),
  storagePreviewLoopButton: document.getElementById("storagePreviewLoopButton"),
  storagePreviewShuffleButton: document.getElementById("storagePreviewShuffleButton"),
  sdEnabled: document.getElementById("sdEnabled"),
  sdCsPin: document.getElementById("sdCsPin"),
  sdSckPin: document.getElementById("sdSckPin"),
  sdMosiPin: document.getElementById("sdMosiPin"),
  sdMisoPin: document.getElementById("sdMisoPin"),
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

function isPlaybackActive(status = state.status) {
  const playbackState = String(status?.playback?.state || "idle");
  return playbackState === "playing" || playbackState === "buffering";
}

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

function renderPlaybackHero(status, audioMuted) {
  if (!elements.audioPill || !elements.audioPillState || !elements.audioPillTitle) {
    return;
  }

  const playbackState = audioMuted ? "Muted" : String(status?.playback?.state || "idle");
  const tone = audioMuted ? "warn" : (isPlaybackActive(status) ? "ok" : "warn");

  elements.audioPill.className = "stat-value stat-value-playback";
  elements.audioPillState.textContent = playbackState;
  elements.audioPillState.className = `playback-hero-state ${tone}`;
  elements.audioPillTitle.textContent = currentPlaybackHeroTitle(status);
  elements.audioPillTitle.title = elements.audioPillTitle.textContent;
  updatePlaybackHeroControls();
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
  for (const pin of currentSdPins(settings)) {
    reservedPins.add(pin);
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

function activeGpioBoardProfile(status = state.status) {
  const selectedBoard = String(elements.gpioBoardSelector?.value || "");
  if (selectedBoard && GPIO_BOARD_LAYOUTS[selectedBoard]) {
    return selectedBoard;
  }
  return detectGpioBoardProfile(status);
}

function statusLedRoleLabel(settings = state.settings, status = state.status) {
  const statusLedPin = Number(elements.statusLedPin?.value || settings?.device?.statusLedPin || 0);
  if (statusLedPin === 21) {
    return "Builtin RGB";
  }
  const boardProfile = activeGpioBoardProfile(status);
  if (statusLedPin === 10 && WS_STATUS_LED_BOARD_PROFILES.has(boardProfile)) {
    return "WS Status LED";
  }
  return "Status LED";
}

function statusLedPinLabel(pin) {
  const chipFamily = String(state.status?.firmware?.chipFamily || "esp32s3").toLowerCase();
  if (chipFamily === "esp32s3") {
    if (pin === 21) {
      return "GPIO21 (built-in WS2812)";
    }
    if (pin === 10 && WS_STATUS_LED_BOARD_PROFILES.has(activeGpioBoardProfile())) {
      return "GPIO10 (WS status LED default)";
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
  for (const pin of currentSdPins(settings)) {
    reservedPins.add(pin);
  }
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

function storageTargetLabel(target = state.activeStorageTarget) {
  return target === "sd" ? "SD Card" : "Flash FS";
}

function flashStorageAvailable(status = state.status) {
  return Boolean(status?.system?.spiffs?.available);
}

function resolveStorageTarget(target = state.activeStorageTarget || "flash") {
  return target === "flash" && !flashStorageAvailable() ? "sd" : target;
}

function activateTabByName(tabName) {
  const button = document.querySelector(`.tab-button[data-tab="${tabName}"]`);
  if (!button || button.hidden || button.disabled) {
    return false;
  }
  button.click();
  return true;
}

function activeTabName() {
  return document.querySelector('.tab-button[aria-selected="true"]')?.dataset.tab || "";
}

async function refreshExternalStorageTab(directoryPath = state.currentStoragePathByTarget.sd || "/", options = {}) {
  state.storageInitialLoadRequested = true;
  state.activeStorageTarget = "sd";
  state.currentStoragePathByTarget.sd = normalizeStorageDirectoryPath(directoryPath);
  if (shouldDeferSdReads() && activeStorageEntries("sd").length) {
    state.deferredStorageReload = true;
    setStorageStatus("Using cached folder view during playback. Stop playback or scroll later to refresh from SD.");
    rerenderStorageManager("sd");
    return { storage: state.storageInfoByTarget.sd || {}, entries: activeStorageEntries("sd"), hasMore: Boolean(activeStorageMeta("sd").hasMore) };
  }
  state.deferredStorageReload = false;
  setStorageStatus("Loading files...");
  const payload = await refreshStorageManager("sd", directoryPath, options);
  if (elements.storageProgressFill) {
    elements.storageProgressFill.style.width = "0%";
  }
  if (elements.storageProgressLabel) {
    elements.storageProgressLabel.textContent = "Idle";
  }
  if (!payload?.hasMore) {
    setStorageStatus("Ready");
  }
  return payload;
}

function updateStorageAvailabilityUi(status = state.status) {
  const flashAvailable = flashStorageAvailable(status);
  const internalStorageTabButton = document.querySelector('.tab-button[data-tab="storage-internal"]');
  const internalStoragePanel = document.getElementById("tab-storage-internal");

  if (internalStorageTabButton) {
    internalStorageTabButton.hidden = !flashAvailable;
    internalStorageTabButton.disabled = !flashAvailable;
    if (!flashAvailable) {
      internalStorageTabButton.setAttribute("aria-selected", "false");
    }
  }

  if (internalStoragePanel) {
    internalStoragePanel.hidden = !flashAvailable;
    if (!flashAvailable) {
      internalStoragePanel.classList.remove("active");
    }
  }

  if (elements.storageFlashButton) {
    elements.storageFlashButton.hidden = !flashAvailable;
    elements.storageFlashButton.disabled = !flashAvailable;
  }

  if (!flashAvailable && state.activeStorageTarget === "flash") {
    state.activeStorageTarget = "sd";
  }

  const activeTabButton = document.querySelector('.tab-button[aria-selected="true"]');
  if (activeTabButton && (activeTabButton.hidden || activeTabButton.disabled)) {
    const fallbackTabButton = [...document.querySelectorAll(".tab-button")]
      .find((button) => !button.hidden && !button.disabled);
    fallbackTabButton?.click();
  }
}

function currentSdPins(settings = state.settings, options = {}) {
  const { respectEnabled = true } = options;
  const enabled = true;
  if (respectEnabled && !enabled) {
    return [];
  }

  return [
    Number(elements.sdCsPin?.value || settings?.sd?.csPin || DEFAULT_SD_GPIO_PINS.cs),
    Number(elements.sdSckPin?.value || settings?.sd?.sckPin || DEFAULT_SD_GPIO_PINS.sck),
    Number(elements.sdMosiPin?.value || settings?.sd?.mosiPin || DEFAULT_SD_GPIO_PINS.mosi),
    Number(elements.sdMisoPin?.value || settings?.sd?.misoPin || DEFAULT_SD_GPIO_PINS.miso),
  ].filter((pin) => Number.isFinite(pin) && pin >= 0);
}

function reservedSdPins(settings = state.settings) {
  const reservedPins = new Set(currentI2sPins());
  const batteryAdcPin = Number(elements.batteryAdcPin?.value || settings?.battery?.adcPin || 0);
  const chargingSensePin = Number(settings?.battery?.chargingSensePin || 0);
  const statusLedPin = Number(elements.statusLedPin?.value || settings?.device?.statusLedPin || 0);
  const displayType = String(elements.displayType?.value || settings?.oled?.displayType || "oled").toLowerCase();
  const wapeTriggerPin = Number(elements.wapeTriggerPin?.value || settings?.oled?.wapeTriggerPin || 0);

  if (Number.isFinite(batteryAdcPin) && batteryAdcPin > 0) {
    reservedPins.add(batteryAdcPin);
  }
  if (Number.isFinite(chargingSensePin) && chargingSensePin > 0) {
    reservedPins.add(chargingSensePin);
  }
  if (Number.isFinite(statusLedPin) && statusLedPin >= 0) {
    reservedPins.add(statusLedPin);
  }
  if (displayType === "wape" && Number.isFinite(wapeTriggerPin) && wapeTriggerPin > 0) {
    reservedPins.add(wapeTriggerPin);
  }

  return reservedPins;
}

function populateSdPinOptions(settings = state.settings) {
  const sdFields = [elements.sdCsPin, elements.sdSckPin, elements.sdMosiPin, elements.sdMisoPin];
  if (sdFields.some((field) => !field)) {
    return;
  }

  const selectedPins = {
    cs: String(elements.sdCsPin.value || settings?.sd?.csPin || DEFAULT_SD_GPIO_PINS.cs),
    sck: String(elements.sdSckPin.value || settings?.sd?.sckPin || DEFAULT_SD_GPIO_PINS.sck),
    mosi: String(elements.sdMosiPin.value || settings?.sd?.mosiPin || DEFAULT_SD_GPIO_PINS.mosi),
    miso: String(elements.sdMisoPin.value || settings?.sd?.misoPin || DEFAULT_SD_GPIO_PINS.miso),
  };
  const reservedPins = reservedSdPins(settings);

  for (const field of sdFields) {
    field.innerHTML = "";
    for (let pin = 0; pin <= chipMaxPin(); pin += 1) {
      if (reservedPins.has(pin)) {
        continue;
      }
      const option = document.createElement("option");
      option.value = String(pin);
      option.textContent = `GPIO${pin}`;
      field.append(option);
    }
  }

  const applySelectedOrFallback = (field, selectedValue, fallbackPin) => {
    if ([...field.options].some((option) => option.value === selectedValue)) {
      field.value = selectedValue;
      return;
    }
    const fallbackValue = String(fallbackPin);
    if ([...field.options].some((option) => option.value === fallbackValue)) {
      field.value = fallbackValue;
      return;
    }
    field.value = field.options[0]?.value || "0";
  };

  applySelectedOrFallback(elements.sdCsPin, selectedPins.cs, DEFAULT_SD_GPIO_PINS.cs);
  applySelectedOrFallback(elements.sdSckPin, selectedPins.sck, DEFAULT_SD_GPIO_PINS.sck);
  applySelectedOrFallback(elements.sdMosiPin, selectedPins.mosi, DEFAULT_SD_GPIO_PINS.mosi);
  applySelectedOrFallback(elements.sdMisoPin, selectedPins.miso, DEFAULT_SD_GPIO_PINS.miso);
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
  for (const pin of currentSdPins(settings)) {
    reservedPins.add(pin);
  }
  reservedPins.add(DOCUMENTED_BUZZER_PIN);

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
  for (const pin of currentSdPins(settings)) {
    reservedPins.add(pin);
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

function preferredRadioSelection() {
  const savedSelection = loadSavedRadioSelection();
  return {
    country: savedSelection.country || DEFAULT_RADIO_SELECTION.country,
    stationName: savedSelection.stationName || DEFAULT_RADIO_SELECTION.stationName,
    stationUrl: savedSelection.stationUrl || DEFAULT_RADIO_SELECTION.stationUrl,
  };
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
  updatePlaybackHeroControls();
}

function renderRadioCountries(countries) {
  if (!elements.radioCountrySelect) {
    return;
  }

  const savedSelection = preferredRadioSelection();
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
  updatePlaybackHeroControls();
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

    const savedSelection = preferredRadioSelection();
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

    const savedSelection = preferredRadioSelection();
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

async function applySelectedRadioStation(options = {}) {
  const { autoPlay = false } = options;
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

  if (!autoPlay || !isPlaybackActive() || state.playbackActionInProgress) {
    return;
  }

  if (!elements.playForm?.reportValidity()) {
    return;
  }

  setRadioBrowserStatus(`Switching to ${station.name}...`);
  await submitPlay();
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

function setStorageStatus(message, isError = false) {
  if (!elements.storageStatus) {
    return;
  }
  elements.storageStatus.textContent = message;
  elements.storageStatus.style.color = isError ? "#b42318" : "";
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

function setHeaderActionsMenuOpen(open) {
  state.headerActionsMenuOpen = Boolean(open);
  if (elements.headerActionsMenu) {
    elements.headerActionsMenu.dataset.open = String(state.headerActionsMenuOpen);
    elements.headerActionsMenu.setAttribute("aria-hidden", String(!state.headerActionsMenuOpen));
  }
  if (elements.headerActionsButton) {
    elements.headerActionsButton.setAttribute("aria-expanded", String(state.headerActionsMenuOpen));
  }
}

function rebootOverlayCircumference() {
  return 2 * Math.PI * 52;
}

function updateRebootOverlayProgress(remainingSeconds, totalSeconds) {
  if (elements.rebootOverlayCountdown) {
    elements.rebootOverlayCountdown.textContent = String(Math.max(0, Math.ceil(remainingSeconds)));
  }
  if (elements.rebootOverlayProgress) {
    const clampedTotal = Math.max(1, Number(totalSeconds || 30));
    const clampedRemaining = Math.max(0, Math.min(clampedTotal, Number(remainingSeconds || 0)));
    const progress = 1 - (clampedRemaining / clampedTotal);
    const circumference = rebootOverlayCircumference();
    elements.rebootOverlayProgress.style.strokeDasharray = `${circumference}`;
    elements.rebootOverlayProgress.style.strokeDashoffset = `${circumference * (1 - progress)}`;
  }
}

function hideRebootOverlay() {
  if (state.rebootOverlayTimer) {
    window.clearInterval(state.rebootOverlayTimer);
    state.rebootOverlayTimer = null;
  }
  if (state.rebootOverlayPollTimer) {
    window.clearInterval(state.rebootOverlayPollTimer);
    state.rebootOverlayPollTimer = null;
  }
  state.rebootOverlayCountdownRemaining = 0;
  state.rebootOverlayStartedAt = 0;
  state.rebootOverlayReconnectAllowedAt = 0;
  state.rebootOverlaySawDisconnect = false;
  state.rebootOverlayArmed = false;
  if (elements.rebootOverlay) {
    elements.rebootOverlay.hidden = true;
  }
}

function clearFirmwareReconnectState() {
  state.awaitingFirmwareReboot = false;
  state.firmwareReloadPending = false;
  if (state.firmwareReloadTimer) {
    window.clearTimeout(state.firmwareReloadTimer);
    state.firmwareReloadTimer = null;
  }
  hideRebootOverlay();
}

function resetTransientOverlays() {
  hideRebootOverlay();
  setHeaderActionsMenuOpen(false);
}

function performFrontendHardRefresh() {
  try {
    if ("caches" in window) {
      caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))).catch(() => {});
    }
  } catch {
  }
  const url = new URL(window.location.href);
  url.searchParams.set("ts", String(Date.now()));
  window.location.replace(url.toString());
}

function showRebootOverlay(title = "Rebooting device...", totalSeconds = 30) {
  if (!state.rebootOverlayArmed) {
    hideRebootOverlay();
    return;
  }
  const overlayArmed = state.rebootOverlayArmed;
  hideRebootOverlay();
  state.rebootOverlayArmed = overlayArmed;
  setHeaderActionsMenuOpen(false);
  const reconnectGraceMs = Math.min(6000, Math.max(1500, Math.round(Number(totalSeconds || 30) * 250)));
  state.rebootOverlayStartedAt = Date.now();
  state.rebootOverlayReconnectAllowedAt = state.rebootOverlayStartedAt + reconnectGraceMs;
  state.rebootOverlaySawDisconnect = false;
  state.rebootOverlayCountdownRemaining = totalSeconds;
  if (elements.rebootOverlayTitle) {
    elements.rebootOverlayTitle.textContent = title;
  }
  if (elements.rebootOverlayStatus) {
    elements.rebootOverlayStatus.textContent = "Waiting for device to come back online.";
  }
  updateRebootOverlayProgress(totalSeconds, totalSeconds);
  if (elements.rebootOverlay) {
    elements.rebootOverlay.hidden = false;
  }

  const startedAt = state.rebootOverlayStartedAt;
  let reloadTriggered = false;
  const tryReconnect = async () => {
    try {
      await fetch(`/api/status?ts=${Date.now()}`, { cache: "no-store" });
      if (!state.rebootOverlaySawDisconnect && Date.now() < state.rebootOverlayReconnectAllowedAt) {
        return;
      }
      if (elements.rebootOverlayStatus) {
        elements.rebootOverlayStatus.textContent = "Device is back online. Refreshing page...";
      }
      if (!reloadTriggered) {
        reloadTriggered = true;
        hideRebootOverlay();
        window.setTimeout(() => performFrontendHardRefresh(), 250);
      }
    } catch {
      state.rebootOverlaySawDisconnect = true;
      const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
      if (elapsedSeconds >= totalSeconds && elements.rebootOverlayStatus) {
        elements.rebootOverlayStatus.textContent = "Still waiting for reconnect...";
      }
    }
  };

  state.rebootOverlayTimer = window.setInterval(() => {
    const elapsed = (Date.now() - startedAt) / 1000;
    const remaining = Math.max(0, totalSeconds - elapsed);
    state.rebootOverlayCountdownRemaining = remaining;
    updateRebootOverlayProgress(remaining, totalSeconds);
  }, 250);

  state.rebootOverlayPollTimer = window.setInterval(() => {
    tryReconnect().catch(() => {});
  }, 1500);
}

function parseDecimalFieldValue(field, fallback = 0) {
  if (!field) {
    return Number(fallback || 0);
  }
  normalizeDecimalField(field);
  const normalized = String(field.value || "").trim();
  if (!normalized) {
    return Number(fallback || 0);
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number(fallback || 0);
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function formatTransferRate(bytesPerSecond) {
  const numericRate = Number(bytesPerSecond || 0);
  if (!Number.isFinite(numericRate) || numericRate <= 0) {
    return "0 B/s";
  }
  if (numericRate >= 1024 * 1024) {
    return `${(numericRate / (1024 * 1024)).toFixed(1)} MiB/s`;
  }
  if (numericRate >= 1024) {
    return `${Math.round(numericRate / 1024)} KiB/s`;
  }
  return `${Math.round(numericRate)} B/s`;
}

function storageStreamUrl(path, target = state.activeStorageTarget, download = false) {
  const encodedPath = encodeURIComponent(String(path || ""));
  return `/api/storage/file?target=${encodeURIComponent(target)}&path=${encodedPath}${download ? "&download=1" : ""}`;
}

function normalizeStorageDirectoryPath(path) {
  const raw = String(path || "/").trim().replaceAll("\\", "/");
  if (!raw || raw === "/") {
    return "/";
  }
  const normalized = `/${raw.replace(/^\/+/, "").replace(/\/+/g, "/")}`.replace(/\/+$/, "");
  return normalized || "/";
}

function storageBaseName(path) {
  const normalized = String(path || "").trim().replaceAll("\\", "/");
  if (!normalized) {
    return "";
  }
  const trimmed = normalized.endsWith("/") && normalized.length > 1
    ? normalized.slice(0, -1)
    : normalized;
  const parts = trimmed.split("/").filter(Boolean);
  return parts[parts.length - 1] || trimmed;
}

function storageParentPath(path) {
  const normalized = normalizeStorageDirectoryPath(path);
  if (normalized === "/") {
    return "";
  }
  const parts = normalized.split("/").filter(Boolean);
  parts.pop();
  return parts.length ? `/${parts.join("/")}` : "/";
}

function storageFileExtension(path) {
  const cleanPath = String(path || "");
  const dotIndex = cleanPath.lastIndexOf(".");
  return dotIndex >= 0 ? cleanPath.substring(dotIndex + 1).toLowerCase() : "";
}

function isAudioStoragePath(path) {
  return STORAGE_AUDIO_EXTENSIONS.has(storageFileExtension(path));
}

function activeStorageEntries(target = state.activeStorageTarget) {
  return Array.isArray(state.currentStorageEntriesByTarget[target]) ? state.currentStorageEntriesByTarget[target] : [];
}

function activeStorageMeta(target = state.activeStorageTarget) {
  const meta = state.currentStorageMetaByTarget[target];
  return meta && typeof meta === "object" ? meta : {};
}

function setStorageMeta(meta, target = state.activeStorageTarget) {
  state.currentStorageMetaByTarget[target] = { ...activeStorageMeta(target), ...(meta || {}) };
}

function formatLoadProgress(loaded, total) {
  const safeLoaded = Math.max(0, Number(loaded || 0));
  const safeTotal = Math.max(0, Number(total || 0));
  if (!safeTotal) {
    return `${safeLoaded} loaded`;
  }
  const percent = Math.max(0, Math.min(100, Math.round((safeLoaded * 100) / safeTotal)));
  return `${safeLoaded}/${safeTotal} (${percent}%)`;
}

function mergeStorageEntries(existingEntries, incomingEntries) {
  const merged = [...(Array.isArray(existingEntries) ? existingEntries : [])];
  const seenPaths = new Set(merged.map((entry) => String(entry?.path || "")));
  for (const entry of Array.isArray(incomingEntries) ? incomingEntries : []) {
    const path = String(entry?.path || "");
    if (!path || seenPaths.has(path)) {
      continue;
    }
    seenPaths.add(path);
    merged.push(entry);
  }
  return merged;
}

function activeStorageAudioEntries(target = state.activeStorageTarget) {
  return activeStorageEntries(target).filter((entry) => !entry?.isDirectory && isAudioStoragePath(entry.path));
}

function currentStoragePreviewQueueIndex(target = state.activeStorageTarget) {
  const currentPath = String(state.storagePreviewItem?.path || "");
  if (!currentPath) {
    return -1;
  }
  return activeStorageAudioEntries(target).findIndex((entry) => entry.path === currentPath);
}

function activeStorageSelection(target = state.activeStorageTarget) {
  return Array.isArray(state.storageSelectedPathsByTarget[target]) ? state.storageSelectedPathsByTarget[target] : [];
}

function setStorageSelection(paths, target = state.activeStorageTarget) {
  const uniquePaths = [...new Set((paths || []).filter(Boolean))];
  state.storageSelectedPathsByTarget[target] = uniquePaths;
}

function clearStorageSelection(target = state.activeStorageTarget) {
  setStorageSelection([], target);
}

function selectedStoragePlaybackEntry(target = state.activeStorageTarget) {
  const selectedPaths = activeStorageSelection(target);
  if (selectedPaths.length !== 1) {
    return null;
  }
  const entry = activeStorageEntries(target).find((candidate) => candidate.path === selectedPaths[0]);
  if (!entry || entry.isDirectory || !isAudioStoragePath(entry.path)) {
    return null;
  }
  return entry;
}

function rerenderStorageManager(target = state.activeStorageTarget) {
  renderStorageManager({
    target,
    storage: state.storageInfoByTarget[target] || {},
    currentPath: state.currentStoragePathByTarget[target] || "/",
    entries: activeStorageEntries(target),
    ...activeStorageMeta(target),
  });
}

function formatPlaybackClock(seconds) {
  const totalSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(totalSeconds / 60);
  const remainder = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function storageEntryIconSvg(entry) {
  if (entry?.isDirectory) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h6l2 2h10v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>';
  }
  if (isAudioStoragePath(entry?.path || "")) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v10"></path><path d="M12 14a3 3 0 1 1-2 2.83V8h8"></path></svg>';
  }
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3h6l5 5v13H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"></path><path d="M14 3v5h5"></path></svg>';
}

function storageBadgeLabel(entry) {
  if (entry?.isDirectory) {
    return "Folder";
  }
  return storageFileExtension(entry?.path || "")?.toUpperCase() || "FILE";
}

function storageItemSubtitle(entry) {
  if (entry?.isDirectory) {
    return `Folder • ${entry.path || ""}`;
  }
  return `${formatBytes(entry?.sizeBytes || 0)} • ${entry?.path || ""}`;
}

function updateStorageToolbar(storage = state.storageInfoByTarget[state.activeStorageTarget] || {}) {
  const entries = activeStorageEntries();
  const selectedPaths = activeStorageSelection();
  const playableEntry = selectedStoragePlaybackEntry();
  const allVisibleSelected = entries.length > 0 && entries.every((entry) => selectedPaths.includes(entry.path));
  const setButtonLabel = (button, label) => {
    if (!button) {
      return;
    }
    const labelNode = button.querySelector("span");
    if (labelNode) {
      labelNode.textContent = label;
    }
  };

  if (elements.storageSelectModeButton) {
    elements.storageSelectModeButton.classList.toggle("active", state.storageSelectionMode);
    setButtonLabel(elements.storageSelectModeButton, state.storageSelectionMode ? "Done" : "Select");
  }
  if (elements.storageSelectAllButton) {
    elements.storageSelectAllButton.disabled = !storage.mounted || entries.length === 0;
    setButtonLabel(elements.storageSelectAllButton, allVisibleSelected ? "Clear" : "All");
  }
  if (elements.storageDeleteButton) {
    elements.storageDeleteButton.disabled = selectedPaths.length === 0;
    setButtonLabel(elements.storageDeleteButton, selectedPaths.length > 1 ? `Delete (${selectedPaths.length})` : "Delete");
  }
  if (elements.storagePlayButton) {
    elements.storagePlayButton.disabled = !playableEntry;
    elements.storagePlayButton.classList.toggle("active", Boolean(playableEntry));
    elements.storagePlayButton.title = playableEntry
      ? `Play ${playableEntry.name || playableEntry.path}`
      : "Select one audio file to play";
  }
  if (elements.storageUploadButton) {
    elements.storageUploadButton.disabled = !storage.mounted || state.storageUploadInProgress;
  }
  if (elements.storageNewFolderButton) {
    elements.storageNewFolderButton.disabled = !storage.mounted;
  }
}

function updateStoragePreviewPlaybackControls() {
  const audioEntries = activeStorageAudioEntries();
  const queueIndex = currentStoragePreviewQueueIndex();
  const deviceActive = Boolean(state.storagePreviewPlaybackMode.deviceActive);
  const hasPreviewItem = Boolean(state.storagePreviewItem);

  if (elements.storagePreviewPlayButton) {
    elements.storagePreviewPlayButton.textContent = deviceActive ? "Stop" : "Play";
    elements.storagePreviewPlayButton.classList.toggle("secondary", deviceActive);
    elements.storagePreviewPlayButton.disabled = !hasPreviewItem;
  }
  if (elements.storagePreviewPrevButton) {
    elements.storagePreviewPrevButton.disabled = audioEntries.length <= 1 || queueIndex < 0;
  }
  if (elements.storagePreviewNextButton) {
    elements.storagePreviewNextButton.disabled = audioEntries.length <= 1 || queueIndex < 0;
  }
  if (elements.storagePreviewLoopButton) {
    elements.storagePreviewLoopButton.setAttribute("aria-pressed", String(Boolean(state.storagePreviewPlaybackMode.loop)));
  }
  if (elements.storagePreviewShuffleButton) {
    elements.storagePreviewShuffleButton.setAttribute("aria-pressed", String(Boolean(state.storagePreviewPlaybackMode.shuffle)));
  }

  updateStoragePreviewProgressUi();
}

function releaseStoragePreviewUrls() {
  if (state.storagePreviewObjectUrl) {
    URL.revokeObjectURL(state.storagePreviewObjectUrl);
    state.storagePreviewObjectUrl = "";
  }
  if (state.storagePreviewArtworkUrl) {
    URL.revokeObjectURL(state.storagePreviewArtworkUrl);
    state.storagePreviewArtworkUrl = "";
  }
}

function updateStoragePreviewPath(path = "") {
  if (!elements.storagePreviewPath) {
    return;
  }
  const label = String(path || "").trim();
  elements.storagePreviewPath.textContent = label || "\u00a0";
  elements.storagePreviewPath.title = label;
}

function updateStoragePreviewProgressUi() {
  const playbackState = String(state.status?.playback?.state || "idle");
  const deviceActive = Boolean(state.storagePreviewPlaybackMode.deviceActive);
  const hasPreviewItem = Boolean(state.storagePreviewItem);
  const buffering = deviceActive && playbackState === "buffering";
  const percent = deviceActive ? (buffering ? 42 : 100) : 0;

  if (elements.storagePreviewProgressFill) {
    elements.storagePreviewProgressFill.style.width = `${percent}%`;
  }
  if (elements.storagePreviewProgressLabel) {
    elements.storagePreviewProgressLabel.textContent = deviceActive
      ? (buffering ? "Buffering on device..." : "Playing on device")
      : (hasPreviewItem ? "Ready on device" : "00:00 / 00:00");
  }
}

function parseSynchsafeInt(bytes) {
  return ((bytes[0] & 0x7f) << 21) | ((bytes[1] & 0x7f) << 14) | ((bytes[2] & 0x7f) << 7) | (bytes[3] & 0x7f);
}

function decodeId3Text(frameBytes) {
  if (!frameBytes?.length) {
    return "";
  }

  const encoding = frameBytes[0];
  const body = frameBytes.slice(1);
  if (!body.length) {
    return "";
  }

  try {
    if (encoding === 0) {
      return new TextDecoder("latin1").decode(body).replace(/\u0000/g, " ").trim();
    }
    if (encoding === 1) {
      if (body[0] === 0xfe && body[1] === 0xff) {
        return new TextDecoder("utf-16be").decode(body.slice(2)).replace(/\u0000/g, " ").trim();
      }
      if (body[0] === 0xff && body[1] === 0xfe) {
        return new TextDecoder("utf-16le").decode(body.slice(2)).replace(/\u0000/g, " ").trim();
      }
      return new TextDecoder("utf-16le").decode(body).replace(/\u0000/g, " ").trim();
    }
    if (encoding === 2) {
      return new TextDecoder("utf-16be").decode(body).replace(/\u0000/g, " ").trim();
    }
    if (encoding === 3) {
      return new TextDecoder("utf-8").decode(body).replace(/\u0000/g, " ").trim();
    }
  } catch {
  }

  return "";
}

function findId3Delimiter(bytes, start, encoding) {
  if (encoding === 0 || encoding === 3) {
    const end = bytes.indexOf(0, start);
    return end >= 0 ? end : bytes.length;
  }

  for (let index = start; index + 1 < bytes.length; index += 1) {
    if (bytes[index] === 0 && bytes[index + 1] === 0) {
      return index;
    }
  }
  return bytes.length;
}

function parseId3Metadata(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  if (bytes.length < 10 || String.fromCharCode(...bytes.slice(0, 3)) !== "ID3") {
    return {};
  }

  const version = bytes[3];
  const tagSize = parseSynchsafeInt(bytes.slice(6, 10));
  const limit = Math.min(bytes.length, 10 + tagSize);
  let cursor = 10;
  const metadata = {};

  while (cursor + 10 <= limit) {
    const frameId = String.fromCharCode(...bytes.slice(cursor, cursor + 4));
    if (!frameId.trim()) {
      break;
    }

    const frameSizeBytes = bytes.slice(cursor + 4, cursor + 8);
    const frameSize = version === 4
      ? parseSynchsafeInt(frameSizeBytes)
      : ((frameSizeBytes[0] << 24) | (frameSizeBytes[1] << 16) | (frameSizeBytes[2] << 8) | frameSizeBytes[3]);
    if (!frameSize || cursor + 10 + frameSize > limit) {
      break;
    }

    const frame = bytes.slice(cursor + 10, cursor + 10 + frameSize);
    if (frameId === "TIT2") {
      metadata.title = decodeId3Text(frame) || metadata.title;
    } else if (frameId === "TPE1") {
      metadata.artist = decodeId3Text(frame) || metadata.artist;
    } else if (frameId === "TALB") {
      metadata.album = decodeId3Text(frame) || metadata.album;
    } else if (frameId === "APIC" && frame.length > 4) {
      const encoding = frame[0];
      const mimeEnd = frame.indexOf(0, 1);
      if (mimeEnd > 1) {
        const mimeType = new TextDecoder("latin1").decode(frame.slice(1, mimeEnd));
        const descriptionEnd = findId3Delimiter(frame, mimeEnd + 2, encoding);
        const imageStart = descriptionEnd + ((encoding === 0 || encoding === 3) ? 1 : 2);
        if (imageStart < frame.length) {
          metadata.artworkBytes = frame.slice(imageStart);
          metadata.artworkType = mimeType || "image/jpeg";
        }
      }
    }

    cursor += 10 + frameSize;
  }

  return metadata;
}

function filenameStem(value) {
  return String(value || "")
    .replace(/^.*[\\/]/, "")
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizedArtworkSearchTerm(value) {
  return String(value || "")
    .replace(/\.[^.]+$/, "")
    .replace(/^\s*\d+\s*[\].\-_:)]*\s*/i, "")
    .replace(/\bfeat\.?\b.*$/i, "")
    .replace(/\bft\.?\b.*$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function setStoragePreviewArtworkStatus(message) {
  if (elements.storagePreviewArtworkStatus) {
    elements.storagePreviewArtworkStatus.textContent = message || "";
  }
}

function storageFilenameStem(value) {
  return String(value || "")
    .replace(/^.*[\\/]/, "")
    .replace(/\.[^.]+$/, "");
}

function storageParentDirectoryPath(path) {
  const normalized = normalizeStorageDirectoryPath(path);
  if (normalized === "/") {
    return "/";
  }
  const lastSlash = normalized.lastIndexOf("/");
  return lastSlash <= 0 ? "/" : normalized.slice(0, lastSlash);
}

function artworkExtensionFromType(contentType = "") {
  const normalized = String(contentType || "").toLowerCase();
  if (normalized.includes("png")) {
    return "png";
  }
  if (normalized.includes("webp")) {
    return "webp";
  }
  if (normalized.includes("jpeg") || normalized.includes("jpg")) {
    return "jpg";
  }
  return "jpg";
}

function localArtworkCandidatePaths(path) {
  const directoryPath = storageParentDirectoryPath(path);
  const stem = storageFilenameStem(path);
  const extensions = ["jpg", "jpeg", "png", "webp"];
  const candidates = [];

  for (const extension of extensions) {
    candidates.push(storageJoinPath(directoryPath, `${stem}.cover.${extension}`));
  }
  for (const basename of ["cover", "folder", "front", "album"]) {
    for (const extension of extensions) {
      candidates.push(storageJoinPath(directoryPath, `${basename}.${extension}`));
    }
  }

  return candidates.filter(Boolean);
}

async function applyStoragePreviewArtworkSource(sourceUrl) {
  if (!sourceUrl || !elements.storagePreviewArtwork) {
    return false;
  }

  const image = elements.storagePreviewArtwork;
  const loaded = await new Promise((resolve) => {
    const cleanup = () => {
      image.onload = null;
      image.onerror = null;
    };
    image.onload = () => {
      cleanup();
      resolve(true);
    };
    image.onerror = () => {
      cleanup();
      resolve(false);
    };
    image.src = sourceUrl;
    image.hidden = false;
  });

  if (loaded && elements.storagePreviewArtworkFallback) {
    elements.storagePreviewArtworkFallback.hidden = true;
  }
  if (!loaded) {
    image.hidden = true;
    image.removeAttribute("src");
    if (elements.storagePreviewArtworkFallback) {
      elements.storagePreviewArtworkFallback.hidden = false;
    }
  }
  return loaded;
}

async function fetchRemoteArtworkUrl({ title = "", artist = "", album = "", fileName = "" } = {}) {
  const searchTerms = [
    [artist, album].filter(Boolean).join(" "),
    [artist, title].filter(Boolean).join(" "),
    [album, title].filter(Boolean).join(" "),
    title,
    album,
    normalizedArtworkSearchTerm(fileName),
    filenameStem(fileName),
  ].map((term) => normalizedArtworkSearchTerm(term)).filter(Boolean);

  const uniqueTerms = [...new Set(searchTerms)];

  for (const term of uniqueTerms) {
    try {
      const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=10`, {
        cache: "no-store",
      });
      if (!response.ok) {
        continue;
      }
      const payload = await response.json();
      const results = Array.isArray(payload?.results) ? payload.results : [];
      const artworkUrl = results
        .map((item) => item?.artworkUrl100 || item?.artworkUrl60 || item?.artworkUrl30 || "")
        .find(Boolean);
      if (artworkUrl) {
        return artworkUrl.replace(/\/[0-9]+x[0-9]+bb\./, "/600x600bb.");
      }
    } catch {
    }
  }

  return "";
}

async function findLocalArtworkUrl(entry, target = state.activeStorageTarget) {
  if (!entry?.path) {
    return "";
  }

  const resolvedTarget = resolveStorageTarget(target);
  const availableEntries = activeStorageEntries(resolvedTarget)
    .filter((candidate) => !candidate?.isDirectory)
    .map((candidate) => String(candidate.path || ""));
  for (const candidatePath of localArtworkCandidatePaths(entry.path)) {
    if (availableEntries.includes(candidatePath)) {
      return storageStreamUrl(candidatePath, resolvedTarget);
    }
  }

  if (resolvedTarget === "sd") {
    return "";
  }

  const directoryPath = storageParentDirectoryPath(entry.path);
  try {
    const payload = await request(`/api/storage?target=${encodeURIComponent(resolvedTarget)}&dir=${encodeURIComponent(directoryPath)}`);
    const remoteEntries = Array.isArray(payload?.entries) ? payload.entries : [];
    const remotePaths = new Set(remoteEntries.filter((candidate) => !candidate?.isDirectory).map((candidate) => String(candidate.path || "")));
    for (const candidatePath of localArtworkCandidatePaths(entry.path)) {
      if (remotePaths.has(candidatePath)) {
        return storageStreamUrl(candidatePath, resolvedTarget);
      }
    }
  } catch {
  }

  return "";
}

async function uploadArtworkToStorage(entry, artworkBlob, contentType = "") {
  if (!entry?.path || !(artworkBlob instanceof Blob) || artworkBlob.size <= 0) {
    return "";
  }

  const directoryPath = storageParentDirectoryPath(entry.path);
  const filename = `${storageFilenameStem(entry.path)}.cover.${artworkExtensionFromType(contentType || artworkBlob.type)}`;
  const formData = new FormData();
  formData.append("file", artworkBlob, filename);

  const response = await fetch(`/api/storage/upload?target=${encodeURIComponent(state.activeStorageTarget)}&dir=${encodeURIComponent(directoryPath)}`, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Artwork upload failed.");
  }

  try {
    const payload = await response.json();
    return String(payload?.path || storageJoinPath(directoryPath, filename));
  } catch {
    return storageJoinPath(directoryPath, filename);
  }
}

async function cacheRemoteArtworkForEntry(entry, remoteArtworkUrl) {
  if (!entry?.path || !remoteArtworkUrl) {
    return "";
  }

  if (state.storagePreviewTarget === "sd" || shouldDeferSdReads()) {
    return "";
  }

  try {
    const response = await fetch(remoteArtworkUrl, { cache: "no-store" });
    if (!response.ok) {
      return "";
    }
    const artworkBlob = await response.blob();
    const cachedPath = await uploadArtworkToStorage(entry, artworkBlob, response.headers.get("content-type") || artworkBlob.type);
    return cachedPath;
  } catch {
    return "";
  }
}

function resetStoragePreviewUi() {
  if (elements.storagePreviewArtwork) {
    elements.storagePreviewArtwork.hidden = true;
    elements.storagePreviewArtwork.removeAttribute("src");
  }
  if (elements.storagePreviewArtworkFallback) {
    elements.storagePreviewArtworkFallback.hidden = false;
  }
  updateStoragePreviewPath("");
  updateStoragePreviewProgressUi();
  setStoragePreviewArtworkStatus("Waiting for artwork lookup.");
}


function setStoragePreviewSummary({ title, artist, album, fileName, sizeBytes, path } = {}) {
  const resolvedTitle = title || fileName || path || "Track Preview";
  const resolvedArtist = artist || "Unknown artist";
  const resolvedAlbum = album || "Unknown album";
  const resolvedFileName = fileName || path || resolvedTitle;

  if (elements.storagePreviewTitle) {
    elements.storagePreviewTitle.textContent = resolvedTitle;
  }
  if (elements.storagePreviewMeta) {
    elements.storagePreviewMeta.textContent = `${resolvedArtist} • ${resolvedAlbum} • ${formatBytes(sizeBytes || 0)}`;
  }
  updateStoragePreviewPath(path || resolvedFileName);
  if (elements.storagePreviewAlbum) {
    elements.storagePreviewAlbum.textContent = `${resolvedTitle}\n${resolvedArtist}\n${resolvedAlbum || resolvedFileName}`;
  }
}

function storageJoinPath(directoryPath, name) {
  const leaf = String(name || "").trim().replaceAll("\\", "/").replace(/^\/+/, "").replace(/\/+$/, "");
  if (!leaf) {
    return "";
  }
  const dir = normalizeStorageDirectoryPath(directoryPath);
  return dir === "/" ? `/${leaf}` : `${dir}/${leaf}`;
}

function storagePlaybackRef(path, target = state.activeStorageTarget) {
  return `${resolveStorageTarget(target)}:${normalizeStorageDirectoryPath(path)}`;
}

function renderStorageBreadcrumbs(currentPath) {
  if (!elements.storageBreadcrumbs || !elements.storageUpButton) {
    return;
  }

  const normalized = normalizeStorageDirectoryPath(currentPath);
  const segments = normalized.split("/").filter(Boolean);
  const crumbs = [{ label: "Root", path: "/", current: normalized === "/" }];
  let runningPath = "";
  for (const segment of segments) {
    runningPath += `/${segment}`;
    crumbs.push({ label: runningPath, path: runningPath, current: runningPath === normalized });
  }

  elements.storageBreadcrumbs.innerHTML = `
    <div class="storage-crumb-trail">
      ${crumbs.map((crumb, index) => (
        `<button type="button" class="storage-crumb storage-crumb-inline${crumb.current ? ' storage-crumb-current' : ''}" data-storage-nav="${escapeHtml(crumb.path)}"${crumb.current ? ' aria-current="page"' : ''}>${escapeHtml(index === 0 ? crumb.label : crumb.label)}</button>`
      )).join("")}
    </div>
  `;
  elements.storageUpButton.disabled = normalized === "/";
}

function renderStorageRow(entry, selectionMode, selectedPaths) {
  const path = String(entry?.path || "");
  const isSelected = selectedPaths.includes(path);
  const typeClass = entry?.isDirectory ? "folder" : "file";
  return `
    <div class="storage-file-row ${entry?.isDirectory ? "storage-folder-row" : ""} ${isSelected ? "selected" : ""}" data-storage-path="${escapeHtml(path)}" data-storage-kind="${entry?.isDirectory ? "folder" : "file"}" tabindex="0" aria-selected="${isSelected ? "true" : "false"}">
      <label class="storage-entry-check" ${selectionMode ? "" : "hidden"}>
        <input type="checkbox" data-storage-checkbox="${escapeHtml(path)}" ${isSelected ? "checked" : ""} aria-label="Select ${escapeHtml(entry?.name || path || "item")}">
      </label>
      <span class="storage-entry-icon ${typeClass}" aria-hidden="true">${storageEntryIconSvg(entry)}</span>
      <div class="storage-file-meta">
        <div class="storage-file-name">${escapeHtml(entry?.name || path || (entry?.isDirectory ? "Folder" : "File"))}</div>
        <div class="storage-file-subtitle">${escapeHtml(storageItemSubtitle(entry))}</div>
      </div>
      <div class="storage-file-trailing">
        <div class="storage-file-badge">${escapeHtml(storageBadgeLabel(entry))}</div>
        <span class="storage-file-chevron" aria-hidden="true">&#8250;</span>
      </div>
    </div>
  `;
}

function setStorageSelectionMode(enabled) {
  state.storageSelectionMode = Boolean(enabled);
  if (!state.storageSelectionMode && activeStorageSelection().length > 1) {
    setStorageSelection(activeStorageSelection().slice(0, 1));
  }
  rerenderStorageManager();
}

function toggleStorageSelection(path, { additive = false } = {}) {
  if (!path) {
    return;
  }

  const current = activeStorageSelection();
  if (!state.storageSelectionMode) {
    setStorageSelection([path]);
    rerenderStorageManager();
    return;
  }

  if (!additive) {
    setStorageSelection(current.includes(path) && current.length === 1 ? [] : [path]);
  } else if (current.includes(path)) {
    setStorageSelection(current.filter((item) => item !== path));
  } else {
    setStorageSelection([...current, path]);
  }
  rerenderStorageManager();
}

function selectAllStorageEntries() {
  const entries = activeStorageEntries();
  if (!entries.length) {
    return;
  }

  const allPaths = entries.map((entry) => entry.path).filter(Boolean);
  const selectedPaths = activeStorageSelection();
  const allSelected = allPaths.every((path) => selectedPaths.includes(path));
  setStorageSelection(allSelected ? [] : allPaths);
  rerenderStorageManager();
}

async function deleteSelectedStorageItems() {
  const selectedPaths = activeStorageSelection();
  if (!selectedPaths.length) {
    setStorageStatus("Select a file or folder first.", true);
    return;
  }

  const prompt = selectedPaths.length === 1
    ? `Delete ${selectedPaths[0]}?`
    : `Delete ${selectedPaths.length} selected items?`;
  if (!window.confirm(prompt)) {
    return;
  }

  setStorageStatus(`Deleting ${selectedPaths.length === 1 ? selectedPaths[0] : `${selectedPaths.length} items`}...`);
  for (const path of selectedPaths) {
    await request(`/api/storage/delete?target=${encodeURIComponent(state.activeStorageTarget)}&dir=${encodeURIComponent(state.currentStoragePathByTarget[state.activeStorageTarget] || "/")}`, {
      method: "POST",
      body: JSON.stringify({ path }),
    });
  }

  clearStorageSelection();
  if (state.storageSelectionMode) {
    state.storageSelectionMode = false;
  }
  const payload = await refreshStorageManager(state.activeStorageTarget);
  await loadStatus();
  setStorageStatus(payload?.message || (selectedPaths.length === 1 ? `Deleted ${selectedPaths[0]}` : `Deleted ${selectedPaths.length} items`));
  toast(selectedPaths.length === 1 ? `Deleted ${selectedPaths[0]}` : `Deleted ${selectedPaths.length} items`);
}

function closeStoragePreview() {
  if (state.storagePreviewAudio) {
    state.storagePreviewAudio.pause();
    state.storagePreviewAudio.currentTime = 0;
    state.storagePreviewAudio.removeAttribute("src");
  }
  state.storagePreviewPlaybackMode.deviceActive = false;
  state.storagePreviewPlaybackMode.previousDeviceActive = false;
  state.storagePreviewPlaybackMode.suppressAutoAdvance = false;
  releaseStoragePreviewUrls();
  state.storagePreviewItem = null;
  resetStoragePreviewUi();
  updateStoragePreviewPlaybackControls();
  if (elements.storagePreviewMeta) {
    elements.storagePreviewMeta.textContent = "Select a track to preview it.";
  }
  updateStoragePreviewPath("");
  if (elements.storagePreviewAlbum) {
    elements.storagePreviewAlbum.textContent = "Album art unavailable";
  }
  state.storagePreviewTarget = state.activeStorageTarget;
  if (elements.storagePreviewModal?.open) {
    elements.storagePreviewModal.close();
  }
}

async function queueStoragePlayback(entry, target = state.activeStorageTarget) {
  if (!entry || entry.isDirectory || !isAudioStoragePath(entry.path)) {
    setStorageStatus("Select one audio file first.", true);
    return false;
  }

  const resolvedTarget = resolveStorageTarget(target);
  const payload = {
    url: storagePlaybackRef(entry.path, resolvedTarget),
    label: normalizePlaybackTitle(entry.name || entry.path, entry.path),
    type: "media",
  };

  await request("/api/play", { method: "POST", body: JSON.stringify(payload) });
  state.recentPlayback.unshift(payload);
  state.recentPlayback = state.recentPlayback.filter((item, index, array) => index === array.findIndex((candidate) => candidate.url === item.url && candidate.type === item.type));
  saveRecentPlayback();
  renderRecentPlayback();

  const started = await pollStatusUntil(
    (status) => {
      const playbackState = String(status?.playback?.state || "idle");
      const playbackUrl = String(status?.playback?.url || "");
      return (playbackState === "playing" || playbackState === "buffering") && playbackUrl === payload.url;
    },
    12,
    150,
  );

  setMessage(started ? `Playing ${payload.label}` : `Playback queued for ${payload.label}`);
  setStorageStatus(started ? `Playing ${payload.label}` : `Playback queued for ${payload.label}`);
  if (!started) {
    await loadStatus();
  }

  return started;
}

async function playStoragePreviewOnDevice() {
  const entry = state.storagePreviewItem;
  if (!entry) {
    return;
  }

  state.storagePreviewPlaybackMode.suppressAutoAdvance = false;
  const started = await queueStoragePlayback(entry, state.storagePreviewTarget);
  state.storagePreviewPlaybackMode.deviceActive = started;
  updateStoragePreviewPlaybackControls();
}

async function stopStoragePreviewPlayback() {
  if (state.storagePreviewAudio) {
    state.storagePreviewAudio.pause();
    state.storagePreviewAudio.currentTime = 0;
  }
  state.storagePreviewPlaybackMode.suppressAutoAdvance = true;
  await request("/api/stop", { method: "POST", body: JSON.stringify({}) });
  state.storagePreviewPlaybackMode.deviceActive = false;
  updateStoragePreviewPlaybackControls();
  await loadStatus();
  setStorageStatus("Playback stopped");
}

async function toggleStoragePreviewPlayback() {
  if (state.storagePreviewPlaybackMode.deviceActive) {
    await stopStoragePreviewPlayback();
    return;
  }
  await playStoragePreviewOnDevice();
}

async function activateStoragePreviewEntry(entry, { autoplayDevice = false } = {}) {
  await openStoragePreview(entry);
  if (autoplayDevice) {
    await playStoragePreviewOnDevice();
  } else {
    state.storagePreviewPlaybackMode.deviceActive = false;
    updateStoragePreviewPlaybackControls();
  }
}

async function hydrateStoragePreviewMetadataAndArtwork(entry, requestId) {
  if (!entry || requestId !== state.storagePreviewRequestId) {
    return;
  }

  const previewTarget = resolveStorageTarget(state.storagePreviewTarget);
  let title = entry.name || entry.path || "Track Preview";
  let artist = "Unknown artist";
  let album = "Unknown album";
  let artworkApplied = false;
  const extension = storageFileExtension(entry.path);
  const canScanEmbedded = previewTarget !== "sd" && extension === "mp3" && Number(entry.sizeBytes || 0) > 0 &&
    Number(entry.sizeBytes || 0) <= STORAGE_PREVIEW_EMBEDDED_SCAN_MAX_BYTES;

  if (canScanEmbedded) {
    setStoragePreviewArtworkStatus("Checking embedded artwork...");
    try {
      const response = await fetch(storageStreamUrl(entry.path, state.storagePreviewTarget), { cache: "no-store" });
      const blob = await response.blob();
      if (requestId !== state.storagePreviewRequestId) {
        return;
      }

      const metadata = parseId3Metadata(await blob.arrayBuffer());
      if (requestId !== state.storagePreviewRequestId) {
        return;
      }

      title = metadata.title || title;
      artist = metadata.artist || artist;
      album = metadata.album || album;
      setStoragePreviewSummary({
        title,
        artist,
        album,
        fileName: entry.name,
        sizeBytes: entry.sizeBytes || blob.size,
        path: entry.path,
      });

      if (metadata.artworkBytes?.length) {
        const artworkType = String(metadata.artworkType || "image/jpeg").startsWith("image/")
          ? metadata.artworkType
          : "image/jpeg";
        state.storagePreviewArtworkUrl = URL.createObjectURL(new Blob([metadata.artworkBytes], { type: artworkType }));
        artworkApplied = await applyStoragePreviewArtworkSource(state.storagePreviewArtworkUrl);
        if (artworkApplied) {
          setStoragePreviewArtworkStatus("Loaded embedded artwork from file.");
        }
      }
    } catch (error) {
      console.warn("Embedded artwork scan failed", error);
    }
  }

  if (requestId !== state.storagePreviewRequestId) {
    return;
  }

  if (!artworkApplied) {
    setStoragePreviewArtworkStatus(canScanEmbedded
      ? "Checking cached artwork in this folder..."
      : (previewTarget === "sd"
        ? "Skipping SD artwork scan so playback stays immediate."
        : "Skipping heavy embedded scan. Checking cached artwork in this folder..."));
    const localArtworkUrl = previewTarget === "sd" ? "" : await findLocalArtworkUrl(entry, previewTarget);
    if (requestId !== state.storagePreviewRequestId) {
      return;
    }
    if (localArtworkUrl) {
      artworkApplied = await applyStoragePreviewArtworkSource(localArtworkUrl);
      if (artworkApplied) {
        setStoragePreviewArtworkStatus("Loaded cached artwork from storage.");
      }
    }
  }

  if (requestId !== state.storagePreviewRequestId) {
    return;
  }

  if (!artworkApplied && navigator.onLine !== false) {
    setStoragePreviewArtworkStatus("Searching online artwork...");
    const remoteArtworkUrl = await fetchRemoteArtworkUrl({
      title,
      artist: artist === "Unknown artist" ? "" : artist,
      album: album === "Unknown album" ? "" : album,
      fileName: entry.name || entry.path,
    });
    if (requestId !== state.storagePreviewRequestId) {
      return;
    }
    if (remoteArtworkUrl) {
      artworkApplied = await applyStoragePreviewArtworkSource(remoteArtworkUrl);
      if (artworkApplied) {
        if (previewTarget === "sd") {
          setStoragePreviewArtworkStatus("Loaded online artwork.");
        } else {
          setStoragePreviewArtworkStatus("Loaded online artwork. Saving cache for offline use...");
          const cachedPath = await cacheRemoteArtworkForEntry(entry, remoteArtworkUrl);
          if (requestId !== state.storagePreviewRequestId) {
            return;
          }
          setStoragePreviewArtworkStatus(cachedPath
            ? "Loaded online artwork and cached it for offline use."
            : "Loaded online artwork.");
          if (cachedPath && storageParentPath(cachedPath) === normalizeStorageDirectoryPath(state.currentStoragePathByTarget[state.storagePreviewTarget] || "/")) {
            injectVisibleStorageEntry(state.storagePreviewTarget, {
              path: cachedPath,
              name: storageBaseName(cachedPath),
              isDirectory: false,
              sizeBytes: 0,
              url: storageStreamUrl(cachedPath, state.storagePreviewTarget),
            });
          }
        }
      }
    }
  }

  if (requestId !== state.storagePreviewRequestId) {
    return;
  }

  if (!artworkApplied) {
    setStoragePreviewArtworkStatus(navigator.onLine === false
      ? "No embedded or cached artwork found. Device is offline."
      : "No artwork found in file, folder cache, or online search.");
  }

  setStoragePreviewSummary({
    title,
    artist,
    album,
    fileName: entry.name,
    sizeBytes: entry.sizeBytes,
    path: entry.path,
  });
}

async function advanceStoragePreviewTrack(delta, options = {}) {
  const { autoplayDevice = false, respectModes = false } = options;
  const entries = activeStorageAudioEntries();
  if (!entries.length) {
    return;
  }

  const currentIndex = currentStoragePreviewQueueIndex();
  if (currentIndex < 0) {
    await activateStoragePreviewEntry(entries[0], { autoplayDevice });
    return;
  }

  let nextIndex = currentIndex;
  if (respectModes && state.storagePreviewPlaybackMode.shuffle && entries.length > 1) {
    do {
      nextIndex = Math.floor(Math.random() * entries.length);
    } while (nextIndex === currentIndex);
  } else {
    nextIndex = currentIndex + delta;
    if (nextIndex < 0 || nextIndex >= entries.length) {
      if (!state.storagePreviewPlaybackMode.loop && !respectModes) {
        nextIndex = Math.max(0, Math.min(entries.length - 1, nextIndex));
      } else if (!state.storagePreviewPlaybackMode.loop && respectModes) {
        state.storagePreviewPlaybackMode.deviceActive = false;
        updateStoragePreviewPlaybackControls();
        return;
      } else {
        nextIndex = nextIndex < 0 ? entries.length - 1 : 0;
      }
    }
  }

  if (nextIndex === currentIndex && entries.length === 1 && !state.storagePreviewPlaybackMode.loop && respectModes) {
    state.storagePreviewPlaybackMode.deviceActive = false;
    updateStoragePreviewPlaybackControls();
    return;
  }

  await activateStoragePreviewEntry(entries[nextIndex], { autoplayDevice });
}

async function openStoragePreview(entry) {
  if (!entry || entry.isDirectory || !isAudioStoragePath(entry.path)) {
    return;
  }

  state.storagePreviewRequestId += 1;
  const requestId = state.storagePreviewRequestId;
  state.storagePreviewItem = entry;
  state.storagePreviewTarget = state.activeStorageTarget;
  releaseStoragePreviewUrls();
  resetStoragePreviewUi();

  if (elements.storagePreviewTitle) {
    elements.storagePreviewTitle.textContent = entry.name || "Track Preview";
  }
  if (elements.storagePreviewMeta) {
    elements.storagePreviewMeta.textContent = `${formatBytes(entry.sizeBytes || 0)} • ${storageBadgeLabel(entry)}`;
  }
  updateStoragePreviewPath(entry.path);
  if (elements.storagePreviewAlbum) {
    elements.storagePreviewAlbum.textContent = `${entry.name || entry.path}\nUnknown artist\nUnknown album`;
  }
  setStoragePreviewArtworkStatus("Playback can start immediately. Artwork is loading in the background.");
  elements.storagePreviewModal?.showModal();

  updateStoragePreviewPlaybackControls();
  hydrateStoragePreviewMetadataAndArtwork(entry, requestId).catch((error) => {
    if (requestId === state.storagePreviewRequestId) {
      console.warn("Preview metadata/artwork load failed", error);
      setStoragePreviewArtworkStatus("Artwork lookup failed.");
    }
  });
}

function renderStorageManager(payload) {
  const target = resolveStorageTarget(String(payload?.target || state.activeStorageTarget || "flash"));
  const label = storageTargetLabel(target);
  const storage = payload?.storage || state.storageInfoByTarget[target] || {};
  const currentPath = normalizeStorageDirectoryPath(payload?.currentPath || state.currentStoragePathByTarget[target] || "/");
  const incomingEntries = Array.isArray(payload?.entries) ? payload.entries : (Array.isArray(payload?.files) ? payload.files : []);
  const appendEntries = Boolean(payload?.append) && currentPath === state.currentStoragePathByTarget[target];
  const entries = appendEntries ? mergeStorageEntries(activeStorageEntries(target), incomingEntries) : incomingEntries;
  const meta = {
    offset: Number(payload?.offset || 0),
    returned: Number(payload?.returned || incomingEntries.length || 0),
    nextOffset: Number(payload?.nextOffset || entries.length || 0),
    hasMore: Boolean(payload?.hasMore),
    totalEntries: Number(payload?.totalEntries || activeStorageMeta(target).totalEntries || entries.length || 0),
    loadingMore: Boolean(payload?.loadingMore),
    requestId: Number(payload?.requestId || activeStorageMeta(target).requestId || 0),
  };
  state.activeStorageTarget = target;
  state.storageInfoByTarget[target] = storage;
  state.currentStorageEntriesByTarget[target] = entries;
  state.currentStoragePathByTarget[target] = currentPath;
  setStorageMeta(meta, target);

  if (elements.storageTitle) {
    elements.storageTitle.textContent = `${label} File Manager`;
  }
  renderStorageBreadcrumbs(currentPath);

  if (elements.storageSummary) {
    const loadedCount = entries.length;
    const progressSummary = formatLoadProgress(loadedCount, meta.totalEntries || loadedCount);
    const progressLabel = meta.loadingMore || meta.hasMore
      ? ` • showing ${progressSummary}${meta.loadingMore ? ", loading more..." : ""}`
      : "";
    const cardLabel = target === "sd" && Number(storage.cardSizeBytes || 0) > 0
      ? ` • card ${formatBytes(storage.cardSizeBytes || 0)}`
      : "";
    elements.storageSummary.textContent = storage.mounted
      ? `${formatBytes(storage.usedBytes || 0)} used of ${formatBytes(storage.totalBytes || 0)} filesystem • ${formatBytes(storage.freeBytes || 0)} free${cardLabel} • ${currentPath}${progressLabel}`
      : (target === "sd"
        ? "SD card is not mounted or not wired."
        : "Flash filesystem is not mounted.");
  }
  if (elements.storageLimit) {
    elements.storageLimit.textContent = storage.mounted
      ? `Max upload: ${formatBytes(storage.maxUploadBytes || 0)}`
      : "Uploads unavailable";
  }
  if (elements.storageUploadButton) {
    elements.storageUploadButton.disabled = !storage.mounted || state.storageUploadInProgress;
  }
  updateStorageToolbar(storage);
  if (!elements.storageFileList) {
    return;
  }

  if (!storage.mounted) {
    clearStorageSelection(target);
    updateStorageToolbar(storage);
    elements.storageFileList.innerHTML = `<div class="storage-empty-note">${label} is not mounted, so melody storage is unavailable.</div>`;
    return;
  }

  if (!entries.length) {
    clearStorageSelection(target);
    updateStorageToolbar(storage);
    elements.storageFileList.innerHTML = `<div class="storage-empty-note">${meta.loadingMore ? "Loading files..." : "This folder is empty."}</div>`;
    return;
  }

  const visiblePaths = entries.map((entry) => entry.path).filter(Boolean);
  setStorageSelection(activeStorageSelection(target).filter((path) => visiblePaths.includes(path)), target);
  const selectedPaths = activeStorageSelection(target);
  const loadingRow = meta.loadingMore
    ? '<div class="storage-empty-note">Loading more files...</div>'
    : "";
  elements.storageFileList.innerHTML = `${entries.map((entry) => renderStorageRow(entry, state.storageSelectionMode, selectedPaths)).join("")}${loadingRow}`;
  updateStorageToolbar(storage);
}

async function loadMoreStorageEntries(target = state.activeStorageTarget) {
  const meta = activeStorageMeta(target);
  if (meta.loadingMore || !meta.hasMore) {
    return;
  }
  if (target === "sd" && shouldDeferSdReads()) {
    state.deferredStorageReload = true;
    setStorageStatus("Playback is active, so loading more SD files is paused to avoid audio interruptions.");
    return;
  }

  const requestId = Number(meta.requestId || state.storageListRequestId || 0);
  const directoryPath = state.currentStoragePathByTarget[target] || "/";
  setStorageMeta({ loadingMore: true }, target);
  rerenderStorageManager(target);
  const currentEntries = activeStorageEntries(target).length;
  const currentTotal = Number(meta.totalEntries || 0);
  setStorageStatus(`Loading files... ${formatLoadProgress(currentEntries, currentTotal)}`);
  try {
    const payload = await request(`/api/storage?target=${encodeURIComponent(target)}&dir=${encodeURIComponent(normalizeStorageDirectoryPath(directoryPath))}&offset=${encodeURIComponent(Number(meta.nextOffset || 0))}&limit=${encodeURIComponent(STORAGE_SCROLL_PAGE_SIZE)}`);
    if (requestId !== state.storageListRequestId) {
      return;
    }

    renderStorageManager({ ...payload, append: true, loadingMore: false, requestId });
    const loadedEntries = activeStorageEntries(target).length;
    const totalEntries = Number(payload?.totalEntries || activeStorageMeta(target).totalEntries || loadedEntries);
    if (!payload?.hasMore) {
      setStorageStatus("Ready");
    } else {
      setStorageStatus(`Loading files... ${formatLoadProgress(loadedEntries, totalEntries)}`);
    }
  } catch (error) {
    if (requestId === state.storageListRequestId) {
      setStorageMeta({ loadingMore: false }, target);
      rerenderStorageManager(target);
      setStorageStatus(`Unable to load more files: ${error.message}`, true);
    }
    throw error;
  }
}

async function refreshStorageManager(target = state.activeStorageTarget, directoryPath = state.currentStoragePathByTarget[target] || "/", options = {}) {
  const resolvedTarget = resolveStorageTarget(target);
  const normalizedDirectoryPath = normalizeStorageDirectoryPath(directoryPath);
  const requestId = state.storageListRequestId + 1;
  state.storageListRequestId = requestId;
  setStorageMeta({ loadingMore: false, requestId, hasMore: false, nextOffset: 0 }, resolvedTarget);
  const payload = await request(`/api/storage?${storageQueryParams({
    target: resolvedTarget,
    dir: normalizedDirectoryPath,
    offset: 0,
    limit: STORAGE_INITIAL_PAGE_SIZE,
    live: Boolean(options.live),
    reindex: Boolean(options.reindex),
  })}`);
  if (requestId !== state.storageListRequestId) {
    return payload;
  }

  renderStorageManager({ ...payload, append: false, loadingMore: false, requestId });
  if (payload?.hasMore) {
    setStorageStatus(`Loading files... ${formatLoadProgress(activeStorageEntries(resolvedTarget).length, Number(payload?.totalEntries || 0))}`);
  } else {
    setStorageMeta({ loadingMore: false, requestId }, resolvedTarget);
    rerenderStorageManager(resolvedTarget);
    setStorageStatus(`Ready • ${formatLoadProgress(activeStorageEntries(resolvedTarget).length, Number(payload?.totalEntries || activeStorageEntries(resolvedTarget).length))}`);
  }
  queueMicrotask(() => ensureStorageListFilled(resolvedTarget).catch((error) => console.error(error)));
  return payload;
}

function maybeRefreshVisibleStorageTab(force = false) {
  if (activeTabName() !== "storage-external") {
    return;
  }
  const storage = state.storageInfoByTarget.sd || {};
  const entries = activeStorageEntries("sd");
  const meta = activeStorageMeta("sd");
  const needsRefresh = force
    || (!state.storageInitialLoadRequested && !meta.loadingMore)
    || (!entries.length && !storage.mounted && !meta.loadingMore);
  if (!needsRefresh) {
    return;
  }
  refreshExternalStorageTab(state.currentStoragePathByTarget.sd || "/").catch(handleError);
}

async function reindexEffectsFiles() {
  if (state.effectReindexInProgress) {
    const message = "Effect-file reindex is already in progress.";
    if (elements.effectsFileStatus) {
      elements.effectsFileStatus.textContent = message;
    }
    toast(message);
    return;
  }
  state.effectReindexInProgress = true;
  if (elements.effectsReindexButton) {
    elements.effectsReindexButton.disabled = true;
  }
  clearEffectFileOptionsCache();
  try {
    if (elements.effectsFileStatus) {
      elements.effectsFileStatus.textContent = "Starting effect-file reindex...";
    }
    const source = EFFECT_FILE_SOURCES.find((entry) => entry.target === "sd") || EFFECT_FILE_SOURCES[0];
    await rebuildStorageIndexFromBrowser(source.target, source.dir, (progress) => {
      if (elements.effectsFileStatus) {
        elements.effectsFileStatus.textContent = formatBrowserReindexStatus(progress, "Reindexing effect files...");
      }
    });
    if (elements.effectsFileStatus) {
      elements.effectsFileStatus.textContent = "Reindex complete. Reloading effect files...";
    }
    await loadEffectFileOptions();
  } finally {
    state.effectReindexInProgress = false;
    if (elements.effectsReindexButton) {
      elements.effectsReindexButton.disabled = false;
    }
  }
}

async function reindexStorageDirectory(target = state.activeStorageTarget, directoryPath = state.currentStoragePathByTarget[target] || "/") {
  const resolvedTarget = resolveStorageTarget(target);
  if (state.storageReindexInProgressByTarget[resolvedTarget]) {
    const message = "Storage reindex is already in progress.";
    setStorageStatus(message);
    toast(message);
    return;
  }
  state.storageReindexInProgressByTarget[resolvedTarget] = true;
  if (elements.storageReindexButton) {
    elements.storageReindexButton.disabled = true;
  }
  try {
    setStorageStatus("Starting reindex...");
    await rebuildStorageIndexFromBrowser(resolvedTarget, directoryPath, (progress) => {
      setStorageStatus(formatBrowserReindexStatus(progress, "Reindexing files..."));
    });
    setStorageStatus("Reindex complete. Reloading...");
    if (resolvedTarget === "sd") {
      await refreshExternalStorageTab(directoryPath);
    } else {
      await refreshStorageManager(resolvedTarget, directoryPath);
    }
  } finally {
    state.storageReindexInProgressByTarget[resolvedTarget] = false;
    if (elements.storageReindexButton) {
      elements.storageReindexButton.disabled = false;
    }
  }
}

async function ensureStorageListFilled(target = state.activeStorageTarget) {
  if (!elements.storageFileList) {
    return;
  }
  let attempts = 0;
  while (attempts < 6) {
    const meta = activeStorageMeta(target);
    if (!meta?.hasMore || meta.loadingMore) {
      return;
    }
    if (elements.storageFileList.scrollHeight > elements.storageFileList.clientHeight + 12) {
      return;
    }
    attempts += 1;
    await loadMoreStorageEntries(target);
    await delay(30);
  }
}

async function openStorageManager(target = "flash", directoryPath = state.currentStoragePathByTarget[target] || "/") {
  if (!elements.storageFileList) {
    return;
  }
  const resolvedTarget = resolveStorageTarget(target);
  if (resolvedTarget !== "sd") {
    activateTabByName(resolvedTarget === "flash" ? "storage-internal" : "storage-external");
    return;
  }
  activateTabByName("storage-external");
  await refreshExternalStorageTab(directoryPath);
}

async function createStorageFolder() {
  const name = window.prompt("Folder name");
  if (!name) {
    return;
  }
  const trimmedName = String(name).trim();
  if (!trimmedName) {
    setStorageStatus("Folder name is required.", true);
    return;
  }
  setStorageStatus(`Creating ${trimmedName}...`);
  const result = await request(`/api/storage/mkdir?target=${encodeURIComponent(state.activeStorageTarget)}&dir=${encodeURIComponent(state.currentStoragePathByTarget[state.activeStorageTarget] || "/")}`, {
    method: "POST",
    body: JSON.stringify({ name: trimmedName }),
  });
  clearStorageSelection();
  renderStorageManager(result);
  setStorageStatus(result.message || `Created ${trimmedName}`);
  toast(result.message || `Created ${trimmedName}`);
}

async function uploadStorageFile() {
  const file = elements.storageFileInput?.files?.[0];
  if (!file) {
    setStorageStatus("Select an audio file first.", true);
    return;
  }

  const info = state.storageInfoByTarget[state.activeStorageTarget] || (await refreshStorageManager(state.activeStorageTarget)).storage || {};
  const maxUploadBytes = Number(info.maxUploadBytes || 0);
  if (file.size <= 0) {
    setStorageStatus("Selected file is empty.", true);
    return;
  }
  if (maxUploadBytes <= 0 || file.size > maxUploadBytes) {
    setStorageStatus(`File exceeds remaining space. Max upload is ${formatBytes(maxUploadBytes)}.`, true);
    return;
  }

  state.storageUploadInProgress = true;
  renderStorageManager({ storage: info, files: [] });
  setStorageStatus(`Uploading ${file.name}...`);
  elements.storageProgressFill.style.width = "0%";
  elements.storageProgressLabel.textContent = `Uploading ${file.name}... 0%`;

  const formData = new FormData();
  formData.append("file", file, file.name);
  const uploadStartedAt = performance.now();

  await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/storage/upload?target=${encodeURIComponent(state.activeStorageTarget)}&dir=${encodeURIComponent(state.currentStoragePathByTarget[state.activeStorageTarget] || "/")}`);

    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) {
        return;
      }
      const percent = Math.max(0, Math.min(100, Math.round((event.loaded * 100) / event.total)));
      const elapsedSeconds = Math.max((performance.now() - uploadStartedAt) / 1000, 0.001);
      const rate = event.loaded / elapsedSeconds;
      elements.storageProgressFill.style.width = `${percent}%`;
      elements.storageProgressLabel.textContent = `Uploading ${file.name}... ${percent}% (${formatBytes(event.loaded)} / ${formatBytes(event.total)} at ${formatTransferRate(rate)})`;
    });

    xhr.addEventListener("load", () => {
      let payload = {};
      try {
        payload = JSON.parse(xhr.responseText || "{}");
      } catch {
        payload = {};
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(payload);
        return;
      }
      reject(new Error(payload.error || xhr.statusText || "Storage upload failed."));
    });

    xhr.addEventListener("error", () => reject(new Error("Storage upload failed.")));
    xhr.send(formData);
  }).then(async (payload) => {
    renderStorageManager(payload);
    injectVisibleStorageEntry(state.activeStorageTarget, {
      path: payload.path,
      name: storageBaseName(payload.path || file.name),
      isDirectory: false,
      sizeBytes: file.size,
      url: `/api/storage/file?target=${encodeURIComponent(state.activeStorageTarget)}&path=${encodeURIComponent(payload.path || "")}`,
    });
    await loadStatus();
    if (state.activeStorageTarget === "sd" && normalizeStorageDirectoryPath(storageParentPath(payload.path || "")) === "/media/wav") {
      mergeEffectFileOptions([{
        value: `sd:${payload.path}`,
        label: `SD: ${storageBaseName(payload.path || file.name)}`,
      }]);
      renderEffectFileOptions(state.settings);
    }
    setStorageStatus(payload.message || `Uploaded ${file.name}`);
    toast(payload.message || `Uploaded ${file.name}`);
  }).catch(async (error) => {
    await refreshStorageManager(state.activeStorageTarget);
    throw error;
  }).finally(() => {
    state.storageUploadInProgress = false;
    elements.storageFileInput.value = "";
    if (state.storageInfoByTarget[state.activeStorageTarget]) {
      elements.storageUploadButton.disabled = !state.storageInfoByTarget[state.activeStorageTarget].mounted;
    }
    loadStatus().catch((error) => console.error(error));
  });
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

function formatBytes(bytes) {
  const numericBytes = Number(bytes || 0);
  if (!Number.isFinite(numericBytes) || numericBytes <= 0) {
    return "0 B";
  }
  if (numericBytes >= 1024 * 1024) {
    return `${(numericBytes / (1024 * 1024)).toFixed(numericBytes >= 10 * 1024 * 1024 ? 0 : 1)} MiB`;
  }
  if (numericBytes >= 1024) {
    return `${Math.round(numericBytes / 1024)} KiB`;
  }
  return `${Math.round(numericBytes)} B`;
}

function setResourceBar(fillElement, percent) {
  if (!fillElement) {
    return;
  }

  const clampedPercent = Math.max(0, Math.min(100, Math.round(Number(percent || 0))));
  fillElement.style.width = `${clampedPercent}%`;
  fillElement.classList.remove("ok", "warn", "bad");
  fillElement.classList.add(clampedPercent >= 80 ? "bad" : (clampedPercent >= 55 ? "warn" : "ok"));
}

function updateResourceCard(valueElement, fillElement, metaElement, valueText, percent, metaText) {
  if (valueElement) {
    valueElement.textContent = valueText;
  }
  setResourceBar(fillElement, percent);
  if (metaElement) {
    metaElement.textContent = metaText;
  }
}

function pinSummary(pin) {
  const numericPin = Number(pin);
  return Number.isFinite(numericPin) && numericPin >= 0 ? `GPIO${numericPin}` : "-";
}

function setCurrentFirmwareVersion(version) {
  const displayVersion = version || "-";
  elements.firmwareVersionCard.textContent = displayVersion;
  if (elements.heroFirmwareVersion) {
    elements.heroFirmwareVersion.textContent = displayVersion;
  }
  if (elements.heroFirmwareChannel) {
    elements.heroFirmwareChannel.textContent = `(${firmwareReleaseChannel(displayVersion)})`;
  }
}

function detectGpioBoardProfile(status = state.status) {
  const explicitBoardProfile = String(status?.hardware?.boardProfile || "").trim();
  if (explicitBoardProfile && GPIO_BOARD_LAYOUTS[explicitBoardProfile]) {
    return explicitBoardProfile;
  }
  const firmwareChipFamily = String(status?.firmware?.chipFamily || "").toLowerCase();
  const chipModel = String(status?.hardware?.chipModel || "").toLowerCase();
  const psramAvailable = Boolean(status?.system?.psram?.available || status?.system?.psram?.mounted || false);
  const chipToken = firmwareChipFamily || chipModel.replace(/[^a-z0-9]/g, "");

  if (chipToken.includes("esp32c6") || chipToken === "c6") {
    return "esp32-c6";
  }
  if (chipToken.includes("esp32c3") || chipToken === "c3") {
    return "esp32-c3";
  }
  if (chipToken.includes("esp32s2") || chipToken === "s2") {
    return "esp32-s2-psram";
  }
  if (chipToken.includes("esp32s3") || chipToken === "s3") {
    return "esp32-s3-super-mini";
  }
  if (chipToken === "esp32" || chipModel.includes("esp32")) {
    return psramAvailable ? "esp32-wrover" : "esp32-wroom";
  }
  return "esp32-s3-super-mini";
}

function updateGpioBoardSelectorMode(status = state.status) {
  if (!elements.gpioBoardSelector) {
    return;
  }
  const autodetectEnabled = Boolean(elements.gpioBoardAutodetect?.checked ?? true);
  elements.gpioBoardSelector.disabled = autodetectEnabled;
  if (!autodetectEnabled) {
    return;
  }
  const detectedBoard = detectGpioBoardProfile(status);
  if ([...elements.gpioBoardSelector.options].some((option) => option.value === detectedBoard)) {
    elements.gpioBoardSelector.value = detectedBoard;
  }
}

function updateGpioBoardImage() {
  if (!elements.gpioBoardSelector || !elements.gpioBoardImage) {
    return;
  }
  const selectedBoard = String(elements.gpioBoardSelector.value || "esp32-s3-super-mini");
  const asset = GPIO_BOARD_ASSETS[selectedBoard] || GPIO_BOARD_ASSETS["esp32-s3-super-mini"];
  const presentation = GPIO_BOARD_PRESENTATION[selectedBoard] || GPIO_BOARD_PRESENTATION["esp32-s3-super-mini"];
  elements.gpioBoardImage.src = asset.src;
  elements.gpioBoardImage.alt = asset.alt;
  elements.gpioBoardImage.style.transform = presentation.rotation;
  if (elements.gpioBoardRecommendations) {
    elements.gpioBoardRecommendations.className = `gpio-board-recommendations gpio-board-recommendations-${presentation.tone || "neutral"}`;
    elements.gpioBoardRecommendations.innerHTML = `
      <div><strong>${escapeHtml(presentation.rank)}</strong></div>
      <div>${escapeHtml(presentation.recommendation)}</div>
    `;
  }
  renderGpioOverview();
}

function firmwareReleaseChannel(version) {
  const normalized = String(version || "").trim().toLowerCase();
  if (!normalized) {
    return "release";
  }
  return /(alpha|beta|rc|dev|nightly|preview|pre)/.test(normalized) ? "beta" : "release";
}

function setFirmwareAuthorLink(settings = state.settings) {
  if (!elements.heroFirmwareAuthorLink) {
    return;
  }
  const owner = String(settings?.ota?.owner || "elik745i").trim() || "elik745i";
  const repository = String(settings?.ota?.repository || "ESP32-S3-Ceiling-Speaker").trim() || "ESP32-S3-Ceiling-Speaker";
  elements.heroFirmwareAuthorLink.href = `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`;
}

function gpioRoleMap(settings = state.settings, status = state.status) {
  const roleMap = new Map();
  const addRole = (pin, label) => {
    const numericPin = Number(pin);
    if (!Number.isFinite(numericPin) || numericPin < 0) {
      return;
    }
    if (!roleMap.has(numericPin)) {
      roleMap.set(numericPin, []);
    }
    roleMap.get(numericPin).push(label);
  };

  const audio = settings?.audio || {};
  const battery = settings?.battery || {};
  const device = settings?.device || {};
  const oled = settings?.oled || {};
  const sd = settings?.sd || {};
  const chipFamily = String(status?.firmware?.chipFamily || "esp32s3").toLowerCase();

  addRole(audio.doutPin, "I2S DIN");
  addRole(audio.wsPin, "I2S WS");
  addRole(audio.bclkPin, "I2S BCLK");
  addRole(battery.adcPin, "Battery ADC");
  if (Number(battery.chargingSensePin || 0) > 0) {
    addRole(battery.chargingSensePin, "Charge Sense");
  }
  addRole(device.statusLedPin, statusLedRoleLabel(settings, status));
  addRole(5, "Button 1");
  addRole(chipFamily === "esp32" ? 18 : 6, "Button 2");

  if (String(oled.displayType || "oled").toLowerCase() === "wape") {
    if (Number(oled.wapeTriggerPin || 0) > 0) {
      addRole(oled.wapeTriggerPin, "Wape Trigger");
    }
  } else if (oled.enabled) {
    addRole(oled.sdaPin, "OLED SDA");
    addRole(oled.sclPin, "OLED SCL");
    if (Number(oled.resetPin ?? -1) >= 0) {
      addRole(oled.resetPin, "OLED RESET");
    }
  }

  if (sd.enabled) {
    addRole(sd.csPin, "SD CS");
    addRole(sd.sckPin, "SD SCK");
    addRole(sd.mosiPin, "SD MOSI");
    addRole(sd.misoPin, "SD MISO");
  }

  if (!roleMap.has(DOCUMENTED_BUZZER_PIN)) {
    addRole(DOCUMENTED_BUZZER_PIN, "Buzzer Reserved");
  }

  return roleMap;
}

function gpioRoleValue(path, fallback = undefined) {
  const segments = String(path || "").split(".");
  let current = state.settings || {};
  for (const segment of segments) {
    current = current?.[segment];
  }
  return current ?? fallback;
}

function gpioConfigRoleDefinitions(settings = state.settings) {
  const displayType = String(settings?.oled?.displayType || elements.displayType?.value || "oled").toLowerCase();
  const definitions = [
    { key: "audio.wsPin", label: "I2S WS", element: elements.audioWsPin, isAssigned: (value) => Number.isFinite(value) },
    { key: "audio.bclkPin", label: "I2S BCLK", element: elements.audioBclkPin, isAssigned: (value) => Number.isFinite(value) },
    { key: "audio.doutPin", label: "I2S DIN", element: elements.audioDoutPin, isAssigned: (value) => Number.isFinite(value) },
    { key: "battery.adcPin", label: "Battery ADC", element: elements.batteryAdcPin, isAssigned: (value) => Number.isFinite(value) },
    { key: "device.statusLedPin", label: statusLedRoleLabel(settings), element: elements.statusLedPin, isAssigned: (value) => Number.isFinite(value) },
    { key: "sd.csPin", label: "SD CS", element: elements.sdCsPin, isAssigned: (value) => Number.isFinite(value) },
    { key: "sd.sckPin", label: "SD SCK", element: elements.sdSckPin, isAssigned: (value) => Number.isFinite(value) },
    { key: "sd.mosiPin", label: "SD MOSI", element: elements.sdMosiPin, isAssigned: (value) => Number.isFinite(value) },
    { key: "sd.misoPin", label: "SD MISO", element: elements.sdMisoPin, isAssigned: (value) => Number.isFinite(value) },
  ];

  if (displayType === "wape") {
    definitions.push({
      key: "oled.wapeTriggerPin",
      label: "Wape Trigger",
      element: elements.wapeTriggerPin,
      isAssigned: (value) => Number.isFinite(value) && value > 0,
    });
  } else {
    definitions.push(
      { key: "oled.sdaPin", label: "OLED SDA", element: elements.oledSdaPin, isAssigned: (value) => Number.isFinite(value) && value >= 0 },
      { key: "oled.sclPin", label: "OLED SCL", element: elements.oledSclPin, isAssigned: (value) => Number.isFinite(value) && value >= 0 },
      { key: "oled.resetPin", label: "OLED RESET", element: elements.oledResetPin, isAssigned: (value) => Number.isFinite(value) && value >= 0 },
    );
  }

  return definitions;
}

function currentPinForGpioRole(definition) {
  const rawValue = definition.element?.value ?? gpioRoleValue(definition.key);
  const numericValue = Number(rawValue);
  return definition.isAssigned(numericValue) ? numericValue : null;
}

function gpioConfigRoleState(settings = state.settings) {
  const definitions = gpioConfigRoleDefinitions(settings);
  const byKey = new Map(definitions.map((definition) => [definition.key, definition]));
  const pinToRole = new Map();
  const roleToPin = new Map();

  for (const definition of definitions) {
    const pin = currentPinForGpioRole(definition);
    roleToPin.set(definition.key, pin);
    if (pin !== null && !pinToRole.has(pin)) {
      pinToRole.set(pin, definition.key);
    }
  }

  return { definitions, byKey, pinToRole, roleToPin };
}

function gpioConfigOptions(pin, currentRoleKey, roleState) {
  return roleState.definitions.filter((definition) => {
    const assignedPin = roleState.roleToPin.get(definition.key);
    if (definition.key === currentRoleKey) {
      return true;
    }
    if (currentRoleKey && assignedPin === null) {
      return false;
    }
    return assignedPin !== pin;
  });
}

function gpioReservedPinInfo(pin, boardProfile = activeGpioBoardProfile()) {
  return GPIO_BOARD_RESERVED_PINS[boardProfile]?.[pin] || null;
}

function gpioReservedRowClass(reservedInfo) {
  switch (reservedInfo?.kind) {
    case "camera":
      return "gpio-pin-row gpio-pin-row-reserved-camera";
    case "strap":
      return "gpio-pin-row gpio-pin-row-reserved-strap";
    case "psram":
      return "gpio-pin-row gpio-pin-row-reserved-psram";
    case "sd":
      return "gpio-pin-row gpio-pin-row-reserved-sd";
    case "jtag":
      return "gpio-pin-row gpio-pin-row-reserved-jtag";
    case "usb":
      return "gpio-pin-row gpio-pin-row-reserved-usb";
    case "serial":
      return "gpio-pin-row gpio-pin-row-reserved-serial";
    case "onboard":
      return "gpio-pin-row gpio-pin-row-reserved-onboard";
    default:
      return "gpio-pin-row gpio-pin-row-occupied";
  }
}

function gpioDropdownMarkup(item, roleMap, roleState) {
  const rawPin = item?.pin;
  const hasNumericPin = typeof rawPin === "number" && Number.isFinite(rawPin) && rawPin >= 0;
  const numericPin = hasNumericPin ? rawPin : NaN;
  const label = String(item?.label || (hasNumericPin ? `GPIO${numericPin}` : "Pin"));
  if (!hasNumericPin) {
    const normalizedLabel = label.trim().toUpperCase();
    const rowClass = normalizedLabel === "5V" || normalizedLabel === "5V IN" || normalizedLabel === "VBUS"
      ? "gpio-pin-row gpio-pin-row-5v"
      : (normalizedLabel === "GND"
        ? "gpio-pin-row gpio-pin-row-gnd"
        : (normalizedLabel === "3V3" || normalizedLabel === "3.3V"
          ? "gpio-pin-row gpio-pin-row-3v3"
          : "gpio-pin-row"));
    return `
      <label class="${rowClass}">
        <span class="gpio-pin-label">${escapeHtml(label)}</span>
        <span class="gpio-pin-fixed" aria-label="${escapeHtml(label)} assignment">Fixed</span>
      </label>
    `;
  }

  const currentRoleKey = roleState.pinToRole.get(numericPin) || "";
  const currentDefinition = currentRoleKey ? roleState.byKey.get(currentRoleKey) : null;
  const activeRoles = roleMap.get(numericPin) || [];
  const reservedInfo = gpioReservedPinInfo(numericPin);
  const warningTitle = reservedInfo?.warning ? ` title="${escapeHtml(reservedInfo.warning)}"` : "";
  if (reservedInfo) {
    return `
      <label class="${gpioReservedRowClass(reservedInfo)}"${warningTitle}>
        <span class="gpio-pin-label">${escapeHtml(label)}</span>
        <select disabled aria-label="${escapeHtml(label)} assignment"${warningTitle}>
          <option selected>${escapeHtml(reservedInfo.label)}</option>
        </select>
      </label>
    `;
  }
  const selectedLabel = currentDefinition?.label || (activeRoles.length ? activeRoles.join(" + ") : "Unused");
  if (!currentDefinition && activeRoles.length) {
    return `
      <label class="gpio-pin-row">
        <span class="gpio-pin-label">${escapeHtml(label)}</span>
        <select disabled aria-label="${escapeHtml(label)} assignment">
          <option selected>${escapeHtml(selectedLabel)}</option>
        </select>
      </label>
    `;
  }

  const options = gpioConfigOptions(numericPin, currentRoleKey, roleState);
  const rowClass = currentRoleKey || activeRoles.length ? "gpio-pin-row gpio-pin-row-occupied" : "gpio-pin-row gpio-pin-row-unused";
  return `
    <label class="${rowClass}">
      <span class="gpio-pin-label">${escapeHtml(label)}</span>
      <select data-gpio-role-select="true" data-pin="${numericPin}" aria-label="${escapeHtml(label)} assignment">
        ${currentRoleKey ? "" : `<option value="" selected>${escapeHtml(selectedLabel)}</option>`}
        ${options.map((definition) => `<option value="${escapeHtml(definition.key)}"${definition.key === currentRoleKey ? " selected" : ""}>${escapeHtml(definition.label)}</option>`).join("")}
      </select>
    </label>
  `;
}

function renderGpioPinColumn(columnElement, items, roleMap, roleState) {
  if (!columnElement) {
    return;
  }
  columnElement.innerHTML = (items || []).map((item) => gpioDropdownMarkup(item, roleMap, roleState)).join("");
}

function setGpioExtraExpanded(expanded) {
  if (!elements.gpioExtraToggle || !elements.gpioExtraPanel) {
    return;
  }
  elements.gpioExtraToggle.setAttribute("aria-expanded", expanded ? "true" : "false");
  elements.gpioExtraPanel.classList.toggle("gpio-extra-panel-expanded", expanded);
  elements.gpioExtraPanel.setAttribute("aria-hidden", expanded ? "false" : "true");
}

function renderGpioOverview() {
  if (!elements.gpioLeftPins || !elements.gpioRightPins) {
    return;
  }
  const roleMap = gpioRoleMap(state.settings || {}, state.status || {});
  const roleState = gpioConfigRoleState(state.settings || {});
  const selectedBoard = String(elements.gpioBoardSelector?.value || "esp32-s3-super-mini");
  const layout = GPIO_BOARD_LAYOUTS[selectedBoard] || GPIO_BOARD_LAYOUTS["esp32-s3-super-mini"];
  renderGpioPinColumn(elements.gpioLeftPins, layout.left, roleMap, roleState);
  renderGpioPinColumn(elements.gpioRightPins, layout.right, roleMap, roleState);

  const extraLayout = GPIO_BOARD_EXTRA_LAYOUTS[selectedBoard];
  if (elements.gpioExtraSection) {
    elements.gpioExtraSection.hidden = !extraLayout;
  }
  if (extraLayout) {
    renderGpioPinColumn(elements.gpioExtraLeftPins, extraLayout.left, roleMap, roleState);
    renderGpioPinColumn(elements.gpioExtraRightPins, extraLayout.right, roleMap, roleState);
  } else {
    renderGpioPinColumn(elements.gpioExtraLeftPins, [], roleMap, roleState);
    renderGpioPinColumn(elements.gpioExtraRightPins, [], roleMap, roleState);
    setGpioExtraExpanded(false);
  }
}

function syncGpioMappingControls() {
  populateAudioI2sPinOptions(state.settings);
  populateBatteryAdcPinOptions(state.settings);
  populateStatusLedPinOptions(state.settings);
  populateSdPinOptions(state.settings);
  populateOledPinOptions(state.settings);
  populateWapeTriggerPinOptions(state.settings);
  updateAudioI2sUi();
  updateAudioUiState();
  updateBatteryUi();
  updateDisplayModeUi();
  renderOledPreview();
  renderDeviceResources(state.status || {});
  renderGpioOverview();
}

function applyGpioRoleSelection(pin, selectedRoleKey) {
  const numericPin = Number(pin);
  if (!Number.isFinite(numericPin) || !selectedRoleKey) {
    renderGpioOverview();
    return;
  }

  const roleState = gpioConfigRoleState(state.settings || {});
  const selectedDefinition = roleState.byKey.get(selectedRoleKey);
  if (!selectedDefinition?.element) {
    renderGpioOverview();
    return;
  }

  const currentRoleKey = roleState.pinToRole.get(numericPin) || "";
  if (currentRoleKey === selectedRoleKey) {
    renderGpioOverview();
    return;
  }

  const previousPinForSelectedRole = roleState.roleToPin.get(selectedRoleKey);
  if (currentRoleKey && previousPinForSelectedRole === null) {
    renderGpioOverview();
    return;
  }

  selectedDefinition.element.value = String(numericPin);

  if (currentRoleKey && previousPinForSelectedRole !== null && previousPinForSelectedRole !== numericPin) {
    const displacedDefinition = roleState.byKey.get(currentRoleKey);
    if (displacedDefinition?.element) {
      displacedDefinition.element.value = String(previousPinForSelectedRole);
    }
  }

  syncGpioMappingControls();
  queueSettingsSave(150);
}

function renderHardwareSummary(status) {
  const hardware = status?.hardware || {};
  const system = status?.system || {};
  const settings = state.settings || {};
  const audio = settings.audio || {};
  const battery = settings.battery || {};
  const oled = settings.oled || {};
  const sd = settings.sd || {};
  const sdSystem = system.sd || {};
  const hardwareReady = Boolean(hardware.chipModel || hardware.flashSizeBytes || hardware.cpuFreqMHz);

  const boardLabel = hardwareReady ? [
    hardware.chipModel || "ESP32",
    hardware.chipRevision ? `rev ${hardware.chipRevision}` : "",
    hardware.cpuCores ? `${hardware.cpuCores} core${hardware.cpuCores === 1 ? "" : "s"}` : "",
    hardware.cpuFreqMHz ? `${hardware.cpuFreqMHz} MHz` : "",
  ].filter(Boolean).join(" • ") : "Waiting for live status";
  const cpuLabel = hardwareReady ? [
    hardware.cpuCores ? `${hardware.cpuCores} core${hardware.cpuCores === 1 ? "" : "s"}` : "-",
    hardware.cpuFreqMHz ? `${hardware.cpuFreqMHz} MHz` : "",
  ].filter(Boolean).join(" • ") : "Waiting for live status";
  const flashLabel = hardwareReady ? [
    hardware.flashSizeBytes ? formatBytes(hardware.flashSizeBytes) : "-",
    hardware.appPartitionSizeBytes ? `OTA slot ${formatBytes(hardware.appPartitionSizeBytes)}` : "",
    hardware.sketchSizeBytes ? `fw ${formatBytes(hardware.sketchSizeBytes)}` : "",
  ].filter(Boolean).join(" • ") : "Waiting for live status";
  const displayType = String(oled.displayType || "oled").toLowerCase();
  const displayLabel = displayType === "wape"
    ? `Wape • trigger ${pinSummary(oled.wapeTriggerPin || 0)}`
    : `${oled.enabled ? "OLED" : "OLED off"} • SDA ${pinSummary(oled.sdaPin)} • SCL ${pinSummary(oled.sclPin)}`;
  const audioLabel = `WS ${pinSummary(audio.wsPin)} • BCLK ${pinSummary(audio.bclkPin)} • DIN ${pinSummary(audio.doutPin)}`;
  const batteryLabel = pinSummary(battery.adcPin);
  const sdLabel = !sd.enabled
    ? "Disabled"
    : sdSystem.mounted && Number(sdSystem.totalBytes || 0) > 0
      ? `${formatBytes(sdSystem.freeBytes || 0)} free of ${formatBytes(sdSystem.totalBytes || 0)} fs • ${Number(sdSystem.cardSizeBytes || 0) > 0 ? formatBytes(sdSystem.cardSizeBytes || 0) : "card size unknown"} card • GPIO${sd.csPin}/${sd.sckPin}/${sd.mosiPin}/${sd.misoPin}`
      : `Configured • GPIO${sd.csPin}/${sd.sckPin}/${sd.mosiPin}/${sd.misoPin}`;

  if (elements.deviceHardwareBoard) {
    elements.deviceHardwareBoard.textContent = boardLabel || "-";
  }
  if (elements.deviceHardwareCpu) {
    elements.deviceHardwareCpu.textContent = cpuLabel || "-";
  }
  if (elements.deviceHardwareFlash) {
    elements.deviceHardwareFlash.textContent = flashLabel || "-";
  }
  if (elements.deviceHardwareAudio) {
    elements.deviceHardwareAudio.textContent = audioLabel;
  }
  if (elements.deviceHardwareDisplay) {
    elements.deviceHardwareDisplay.textContent = displayLabel;
  }
  if (elements.deviceHardwareBattery) {
    elements.deviceHardwareBattery.textContent = batteryLabel;
  }
  if (elements.deviceHardwareSd) {
    elements.deviceHardwareSd.textContent = sdLabel;
  }
}

function renderDeviceResources(status) {
  const system = status?.system || {};
  const sram = system.sram || {};
  const psram = system.psram || {};
  const spiffs = system.spiffs || {};
  const sd = system.sd || {};
  const sdEnabled = true;
  const systemReady = Boolean(system.cpuLoadPercent || system.freeHeap || sram.totalBytes || psram.totalBytes || spiffs.totalBytes || sd.totalBytes || sdEnabled);

  if (!systemReady) {
    updateResourceCard(
      elements.deviceCpuLoadValue,
      elements.deviceCpuLoadBar,
      elements.deviceCpuLoadMeta,
      "--",
      0,
      "Live metrics appear after the first status refresh."
    );
    updateResourceCard(
      elements.deviceSramValue,
      elements.deviceSramBar,
      elements.deviceSramMeta,
      "--",
      0,
      "Waiting for SRAM usage from the device."
    );
    updateResourceCard(
      elements.devicePsramValue,
      elements.devicePsramBar,
      elements.devicePsramMeta,
      "--",
      0,
      "Waiting for PSRAM status from the device."
    );
    updateResourceCard(
      elements.deviceSpiffsValue,
      elements.deviceSpiffsBar,
      elements.deviceSpiffsMeta,
      "--",
      0,
      "Waiting for filesystem telemetry from the device."
    );
    updateResourceCard(
      elements.deviceSdValue,
      elements.deviceSdBar,
      elements.deviceSdMeta,
      "--",
      0,
      "Waiting for SD card telemetry from the device."
    );
    return;
  }

  const cpuLoadPercent = Math.max(0, Math.min(100, Number(system.cpuLoadPercent || 0)));

  updateResourceCard(
    elements.deviceCpuLoadValue,
    elements.deviceCpuLoadBar,
    elements.deviceCpuLoadMeta,
    `${Math.round(cpuLoadPercent)}%`,
    cpuLoadPercent,
    "Approximate load derived from FreeRTOS idle time."
  );

  const sramUsedPercent = sram.totalBytes > 0 ? (Number(sram.usedBytes || 0) * 100) / Number(sram.totalBytes) : 0;
  updateResourceCard(
    elements.deviceSramValue,
    elements.deviceSramBar,
    elements.deviceSramMeta,
    formatBytes(sram.freeBytes || system.freeHeap || 0),
    sramUsedPercent,
    `${formatBytes(sram.usedBytes || 0)} used of ${formatBytes(sram.totalBytes || 0)} • min free ${formatBytes(system.minFreeHeapBytes || 0)}`
  );

  if (psram.available && Number(psram.totalBytes || 0) > 0) {
    const psramUsedPercent = (Number(psram.usedBytes || 0) * 100) / Number(psram.totalBytes || 0);
    updateResourceCard(
      elements.devicePsramValue,
      elements.devicePsramBar,
      elements.devicePsramMeta,
      formatBytes(psram.freeBytes || 0),
      psramUsedPercent,
      `${formatBytes(psram.usedBytes || 0)} used of ${formatBytes(psram.totalBytes || 0)}`
    );
  } else {
    updateResourceCard(
      elements.devicePsramValue,
      elements.devicePsramBar,
      elements.devicePsramMeta,
      "Not available",
      0,
      "Firmware will keep using internal SRAM only."
    );
  }

  if (spiffs.available && Number(spiffs.totalBytes || 0) > 0) {
    const spiffsUsedPercent = (Number(spiffs.usedBytes || 0) * 100) / Number(spiffs.totalBytes || 0);
    const spiffsMeta = spiffs.mounted
      ? `${formatBytes(spiffs.usedBytes || 0)} used of ${formatBytes(spiffs.totalBytes || 0)}`
      : `${formatBytes(spiffs.totalBytes || 0)} filesystem partition reserved in flash • not mounted`;
    updateResourceCard(
      elements.deviceSpiffsValue,
      elements.deviceSpiffsBar,
      elements.deviceSpiffsMeta,
      spiffs.mounted ? formatBytes(spiffs.freeBytes || 0) : formatBytes(spiffs.totalBytes || 0),
      spiffs.mounted ? spiffsUsedPercent : 0,
      spiffs.mounted ? `${spiffsMeta} • click to manage files` : spiffsMeta
    );
  } else {
    updateResourceCard(
      elements.deviceSpiffsValue,
      elements.deviceSpiffsBar,
      elements.deviceSpiffsMeta,
      "Unavailable",
      0,
      "No flash filesystem partition detected."
    );
  }

  if (sd.available && Number(sd.totalBytes || 0) > 0 && sd.mounted) {
    const sdUsedPercent = (Number(sd.usedBytes || 0) * 100) / Number(sd.totalBytes || 0);
    const cardLabel = Number(sd.cardSizeBytes || 0) > 0 ? ` • card ${formatBytes(sd.cardSizeBytes || 0)}` : "";
    updateResourceCard(
      elements.deviceSdValue,
      elements.deviceSdBar,
      elements.deviceSdMeta,
      formatBytes(sd.freeBytes || 0),
      sdUsedPercent,
      `${formatBytes(sd.usedBytes || 0)} used of ${formatBytes(sd.totalBytes || 0)} filesystem${cardLabel}`
    );
  } else if (sdEnabled) {
    const configuredPins = [state.settings?.sd?.csPin, state.settings?.sd?.sckPin, state.settings?.sd?.mosiPin, state.settings?.sd?.misoPin]
      .map((pin) => `GPIO${pin}`)
      .join(" / ");
    updateResourceCard(
      elements.deviceSdValue,
      elements.deviceSdBar,
      elements.deviceSdMeta,
      "Not mounted",
      0,
      `Configured for ${configuredPins} • use External Storage tab`
    );
  } else {
    updateResourceCard(
      elements.deviceSdValue,
      elements.deviceSdBar,
      elements.deviceSdMeta,
      "Disabled",
      0,
      "SD card is not mounted or not wired."
    );
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

function formatReindexProgress(reindex) {
  const processed = Number(reindex?.processedEntries || 0);
  const total = Number(reindex?.totalEntries || 0);
  const stage = String(reindex?.stage || "working");
  return `${stage} ${formatLoadProgress(processed, total)}`;
}

async function fetchStorageEntryCount(target, directoryPath) {
  const payload = await request(`/api/storage/count?target=${encodeURIComponent(target)}&dir=${encodeURIComponent(normalizeStorageDirectoryPath(directoryPath))}`);
  return Number(payload?.totalEntries || 0);
}

async function uploadGeneratedStorageIndex(target, directoryPath, contents, onProgress) {
  await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/storage/upload?target=${encodeURIComponent(target)}&dir=${encodeURIComponent(normalizeStorageDirectoryPath(directoryPath))}`);
    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) {
        return;
      }
      onProgress?.(Math.max(0, Math.min(100, Math.round((event.loaded * 100) / event.total))));
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(xhr.responseText || xhr.statusText || "Index upload failed."));
      }
    });
    xhr.addEventListener("error", () => reject(new Error("Index upload failed.")));

    const formData = new FormData();
    formData.append("file", new Blob([contents], { type: "text/plain" }), ".index");
    xhr.send(formData);
  });
}

async function rebuildStorageIndexFromBrowser(target, directoryPath, onProgress) {
  const normalizedDirectoryPath = normalizeStorageDirectoryPath(directoryPath);
  const totalEntries = Math.max(0, await fetchStorageEntryCount(target, normalizedDirectoryPath));
  const pageSize = 10;
  let offset = 0;
  let processedEntries = 0;
  let hasMore = true;
  const lines = [];

  onProgress?.({ stage: "counting", processedEntries: 0, totalEntries });
  while (hasMore) {
    const payload = await request(`/api/storage?${storageQueryParams({
      target,
      dir: normalizedDirectoryPath,
      offset,
      limit: pageSize,
      live: true,
      reindex: false,
    })}`);
    for (const entry of payload?.entries || []) {
      const name = String(entry?.name || "");
      if (!name || name === ".index" || name === ".index.tmp") {
        continue;
      }
      lines.push(entry.isDirectory ? `${name}/` : name);
      processedEntries += 1;
      onProgress?.({ stage: "counting", processedEntries, totalEntries: Math.max(totalEntries, processedEntries) });
    }
    offset = Number(payload?.nextOffset || offset + (payload?.entries?.length || 0));
    hasMore = Boolean(payload?.hasMore);
  }

  onProgress?.({ stage: "writing", processedEntries: Math.max(totalEntries, processedEntries), totalEntries: Math.max(totalEntries, processedEntries) });
  await uploadGeneratedStorageIndex(target, normalizedDirectoryPath, `${lines.join("\n")}\n`, (percent) => {
    onProgress?.({
      stage: "writing",
      processedEntries: Math.max(totalEntries, processedEntries),
      totalEntries: Math.max(totalEntries, processedEntries),
      uploadPercent: percent,
    });
  });
  onProgress?.({ stage: "complete", processedEntries: Math.max(totalEntries, processedEntries), totalEntries: Math.max(totalEntries, processedEntries), uploadPercent: 100 });
  return { totalEntries: Math.max(totalEntries, processedEntries) };
}

function formatBrowserReindexStatus(progress, labelPrefix) {
  const stage = String(progress?.stage || "counting");
  if (stage === "writing") {
    return `${labelPrefix} writing index... ${Math.max(0, Math.min(100, Math.round(Number(progress?.uploadPercent || 0))))}%`;
  }
  if (stage === "complete") {
    return `${labelPrefix} 100%`;
  }
  return `${labelPrefix} ${formatLoadProgress(Number(progress?.processedEntries || 0), Number(progress?.totalEntries || 0))}`;
}

function shouldDeferSdReads() {
  return isPlaybackActive(state.status);
}

function mergeEffectFileOptions(options) {
  const byValue = new Map();
  for (const option of state.effectFileOptions || []) {
    byValue.set(option.value, option);
  }
  for (const option of options || []) {
    byValue.set(option.value, option);
  }
  state.effectFileOptions = sortEffectFileOptions([...byValue.values()]);
}

function injectVisibleStorageEntry(target, entry) {
  if (!entry?.path) {
    return;
  }
  const entries = activeStorageEntries(target);
  if (entries.some((item) => item.path === entry.path)) {
    setStorageSelection([entry.path], target);
    rerenderStorageManager(target);
    elements.storageFileList?.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  state.currentStorageEntriesByTarget[target] = [entry, ...entries];
  setStorageSelection([entry.path], target);
  rerenderStorageManager(target);
  elements.storageFileList?.scrollTo({ top: 0, behavior: "smooth" });
}

function showUpdateAvailablePopup(status) {
  const latestVersion = String(status?.ota?.latestVersion || "");
  if (!latestVersion || state.updatePopupShownVersion === latestVersion) {
    return;
  }
  state.updatePopupShownVersion = latestVersion;
  const autoUpdateEnabled = Boolean(state.settings?.ota?.autoUpdate);
  if (elements.updateAvailableBody) {
    elements.updateAvailableBody.textContent = autoUpdateEnabled
      ? `A newer firmware ${latestVersion} is available. Auto-update is enabled, so the device will start installing it after the update-available sound finishes.`
      : `A newer firmware ${latestVersion} is available. Auto-update is disabled, so the device is waiting for a manual install.`;
  }
  if (elements.updateAvailableDialog?.showModal) {
    elements.updateAvailableDialog.showModal();
  }
}

function closeUpdateAvailablePopup() {
  if (elements.updateAvailableDialog?.open) {
    elements.updateAvailableDialog.close();
  }
}

function effectSelectElements() {
  return EFFECT_SELECT_CONFIG
    .map((item) => ({ ...item, element: elements[item.id] }))
    .filter((item) => item.element);
}

function isSupportedAudioFilename(name) {
  return STORAGE_AUDIO_EXTENSIONS.has(storageFileExtension(name));
}

function effectFileLabelFromEntry(source, entry) {
  return `${source.prefix}: ${entry.name}`;
}

function storageQueryParams({ target, dir, offset = 0, limit = 20, live = false, reindex = false }) {
  const params = new URLSearchParams();
  params.set("target", target);
  params.set("dir", dir);
  params.set("offset", String(offset));
  params.set("limit", String(limit));
  if (live) {
    params.set("live", "1");
  }
  if (reindex) {
    params.set("reindex", "1");
  }
  return params.toString();
}

function effectFileLabelFromValue(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "None";
  }
  const separatorIndex = normalized.indexOf(":");
  if (separatorIndex <= 0) {
    return normalized;
  }
  const target = normalized.slice(0, separatorIndex).toLowerCase();
  const path = normalized.slice(separatorIndex + 1);
  const prefix = target === "sd" ? "SD" : (target === "flash" ? "Flash" : target.toUpperCase());
  return `${prefix}: ${storageBaseName(path)}`;
}

function configuredEffectValue(settings, field, element) {
  const configuredValue = settings?.effects?.[field];
  if (configuredValue !== undefined && configuredValue !== null && String(configuredValue).trim()) {
    return String(configuredValue).trim();
  }
  const savedValue = String(element?.dataset?.savedEffectValue || "").trim();
  if (savedValue) {
    return savedValue;
  }
  return String(element?.value || "").trim();
}

function sortEffectFileOptions(options) {
  return [...options].sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: "base" }));
}

function sdSettingsChanged(previousSettings, nextSettings) {
  const previous = previousSettings?.sd || {};
  const next = nextSettings?.sd || {};
  return Boolean(previous.enabled) !== Boolean(next.enabled)
    || Number(previous.csPin || 0) !== Number(next.csPin || 0)
    || Number(previous.sckPin || 0) !== Number(next.sckPin || 0)
    || Number(previous.mosiPin || 0) !== Number(next.mosiPin || 0)
    || Number(previous.misoPin || 0) !== Number(next.misoPin || 0);
}

function effectFilesCacheKey(settings = state.settings) {
  const sd = settings?.sd || {};
  const flashEnabled = true;
  return JSON.stringify({
    sdEnabled: true,
    sdCsPin: Number(sd.csPin || 0),
    sdSckPin: Number(sd.sckPin || 0),
    sdMosiPin: Number(sd.mosiPin || 0),
    sdMisoPin: Number(sd.misoPin || 0),
    flashEnabled,
    sources: EFFECT_FILE_SOURCES.map((source) => `${source.target}:${source.dir}`).join("|"),
  });
}

function persistEffectFileOptionsCache() {
  if (!state.effectFileOptionsLoaded || !state.effectFileOptions.length || !state.effectFileOptionsCacheKey) {
    return;
  }
  try {
    window.sessionStorage.setItem(EFFECT_FILES_CACHE_STORAGE_KEY, JSON.stringify({
      key: state.effectFileOptionsCacheKey,
      options: state.effectFileOptions,
    }));
  } catch {
  }
}

function clearEffectFileOptionsCache() {
  state.effectFileOptions = [];
  state.effectFileOptionsLoaded = false;
  state.effectFileOptionsCacheKey = "";
  try {
    window.sessionStorage.removeItem(EFFECT_FILES_CACHE_STORAGE_KEY);
  } catch {
  }
}

function effectFilesReadyMessage() {
  return "Changing a selection previews that audio file on the device.";
}

function effectFilesUnavailableMessage() {
  return "No supported audio files found in SD /media/wav or flash /wav.";
}

function restoreEffectFileOptionsFromCache(settings = state.settings) {
  const cacheKey = effectFilesCacheKey(settings);
  try {
    const raw = window.sessionStorage.getItem(EFFECT_FILES_CACHE_STORAGE_KEY);
    if (!raw) {
      return false;
    }
    const parsed = JSON.parse(raw);
    if (parsed?.key !== cacheKey || !Array.isArray(parsed?.options)) {
      return false;
    }
    state.effectFileOptions = sortEffectFileOptions(parsed.options
      .filter((option) => option && typeof option.value === "string" && typeof option.label === "string"));
    state.effectFileOptionsLoaded = true;
    state.effectFileOptionsCacheKey = cacheKey;
    return state.effectFileOptions.length > 0;
  } catch {
    return false;
  }
}

function renderEffectFileOptions(settings = state.settings) {
  for (const { field, element } of effectSelectElements()) {
    const currentValue = configuredEffectValue(settings, field, element);
    const currentOptionExists = state.effectFileOptions.some((option) => option.value === currentValue);
    element.dataset.savedEffectValue = currentValue;
    element.innerHTML = "";

    const noneOption = document.createElement("option");
    noneOption.value = "";
    noneOption.textContent = "None";
    element.append(noneOption);

    for (const optionData of state.effectFileOptions) {
      const option = document.createElement("option");
      option.value = optionData.value;
      option.textContent = optionData.label;
      element.append(option);
    }

    if (currentValue && !currentOptionExists) {
      const savedOption = document.createElement("option");
      savedOption.value = currentValue;
      savedOption.textContent = state.effectFileOptionsLoaded
        ? `${effectFileLabelFromValue(currentValue)} (unavailable)`
        : effectFileLabelFromValue(currentValue);
      savedOption.selected = true;
      element.append(savedOption);
    }

    element.value = [...element.options].some((option) => option.value === currentValue) ? currentValue : "";
  }
}

async function loadEffectFileOptions(options = {}) {
  const { reindex = false } = options;
  if (!state.settings) {
    return;
  }
  const cacheKey = effectFilesCacheKey(state.settings);
  if (!reindex && state.effectFileOptionsLoaded && state.effectFileOptionsCacheKey === cacheKey && state.effectFileOptions.length) {
    renderEffectFileOptions(state.settings);
    if (elements.effectsFileStatus) {
      elements.effectsFileStatus.textContent = effectFilesReadyMessage();
    }
    return;
  }
  if (!reindex && !state.effectFilesLoading && restoreEffectFileOptionsFromCache(state.settings)) {
    renderEffectFileOptions(state.settings);
    if (elements.effectsFileStatus) {
      elements.effectsFileStatus.textContent = "Loaded effect files from this browser session cache.";
    }
    return;
  }
  if (shouldDeferSdReads()) {
    state.deferredEffectsReload = true;
    renderEffectFileOptions(state.settings);
    if (elements.effectsFileStatus) {
      elements.effectsFileStatus.textContent = "Playback is active, so SD effect-file scanning is deferred to avoid audio interruptions.";
    }
    return;
  }

  state.effectFilesLoading = true;
  state.deferredEffectsReload = false;
  state.effectFileOptionsLoaded = false;
  state.effectFileOptionsCacheKey = cacheKey;
  if (elements.effectsFileStatus) {
    elements.effectsFileStatus.textContent = "Loading effect files...";
  }
  const previousOptions = Array.isArray(state.effectFileOptions) ? [...state.effectFileOptions] : [];
  let loadedAnySource = false;
  let loadedAnyOptions = false;
  let processedEntries = 0;
  let totalEntries = 0;
  state.effectFileOptions = [];
  try {
    for (const source of EFFECT_FILE_SOURCES) {
      try {
        let offset = 0;
        let hasMore = true;
        let sourceTotalCounted = false;
        while (hasMore) {
          const payload = await request(`/api/storage?${storageQueryParams({
            target: source.target,
            dir: source.dir,
            offset,
            limit: EFFECT_FILE_PAGE_SIZE,
            live: false,
            reindex: reindex && source.target === "sd" && offset === 0,
          })}`);
          loadedAnySource = true;
          if (!sourceTotalCounted) {
            totalEntries += Number(payload?.totalEntries || 0);
            sourceTotalCounted = true;
          }
          processedEntries += Number(payload?.returned || (payload?.entries?.length || 0));
          if (elements.effectsFileStatus) {
            elements.effectsFileStatus.textContent = `Loading effect files... ${formatLoadProgress(processedEntries, totalEntries)}`;
          }
          const pageOptions = [];
          for (const entry of payload.entries || []) {
            if (entry.isDirectory) {
              continue;
            }
            if (!isSupportedAudioFilename(entry.name || entry.path || "")) {
              continue;
            }
            pageOptions.push({
              value: `${source.target}:${entry.path}`,
              label: effectFileLabelFromEntry(source, entry),
            });
          }
          if (pageOptions.length) {
            loadedAnyOptions = true;
          }
          mergeEffectFileOptions(pageOptions);
          renderEffectFileOptions(state.settings);
          offset = Number(payload?.nextOffset || offset + (payload?.entries?.length || 0));
          hasMore = Boolean(payload?.hasMore);
          if (hasMore) {
            await delay(20);
          }
        }
      } catch (error) {
        console.warn(`Skipping effect file source ${source.target}:${source.dir}`, error);
      }
    }
  } finally {
    if (!loadedAnyOptions && previousOptions.length && !loadedAnySource) {
      state.effectFileOptions = previousOptions;
      state.effectFileOptionsLoaded = true;
      renderEffectFileOptions(state.settings);
      if (elements.effectsFileStatus) {
        elements.effectsFileStatus.textContent = "Keeping the cached effect-file list because storage could not be refreshed right now.";
      }
      state.effectFilesLoading = false;
      return;
    }
    if (elements.effectsFileStatus) {
      elements.effectsFileStatus.textContent = state.effectFileOptions.length
        ? effectFilesReadyMessage()
        : (loadedAnySource
          ? effectFilesUnavailableMessage()
          : "Unable to refresh effect files right now. Try again in a moment.");
    }
    state.effectFilesLoading = false;
    state.effectFileOptionsLoaded = true;
    if (state.effectFileOptions.length) {
      persistEffectFileOptionsCache();
    }
    renderEffectFileOptions(state.settings);
  }
}

async function previewEffectFile(effectRef, effectLabel, { ambient = false } = {}) {
  if (!effectRef) {
    return;
  }
  await request("/api/play", {
    method: "POST",
    body: JSON.stringify({
      url: effectRef,
      label: effectLabel,
      type: ambient ? "effect-ambient" : "effect-preview",
    }),
  });
  setMessage(ambient ? `Starting ${effectLabel}` : `Previewing ${effectLabel}`);
}

function syncEffectsPage(settings = state.settings) {
  if (!state.effectFileOptionsLoaded) {
    restoreEffectFileOptionsFromCache(settings);
  }
  renderEffectFileOptions(settings);
}

function syncBatteryPage(settings = state.settings) {
  const derivedMeasuredVoltage = settings?.battery?.calibrationMultiplier && state.status?.battery?.rawAdcVoltage
    ? settings.battery.calibrationMultiplier * state.status.battery.rawAdcVoltage
    : "";
  const savedMeasuredVoltage = Number(settings?.battery?.measuredVoltage || 0);
  const measuredVoltage = state.batteryMeasuredVoltageInput
    || (savedMeasuredVoltage > 0 ? savedMeasuredVoltage.toFixed(3) : "")
    || (derivedMeasuredVoltage ? Number(derivedMeasuredVoltage).toFixed(3) : "");

  state.batteryMeasuredVoltageInput = measuredVoltage;
  if (elements.batteryMeasuredVoltage) {
    elements.batteryMeasuredVoltage.value = measuredVoltage;
  }

  updateDerivedBatteryCalibration();
  updateBatteryUi();
}

function syncPageSections(settings = state.settings) {
  syncEffectsPage(settings);
  syncBatteryPage(settings);
  updateAudioI2sUi();
  updateAudioUiState();
  updateLowBatterySleepUi();
  updateConditionalVisibility();
  updateDisplayModeUi();
  renderHardwareSummary(state.status || {});
  renderDeviceResources(state.status || {});
  renderOledPreview();
}

function fillForm(data) {
  state.settingsLoading = true;
  data.sd ||= {};
  data.sd.enabled = true;
  populateAudioI2sPinOptions(data);
  populateSdPinOptions(data);
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
  if (elements.sdEnabled && data.sd?.enabled !== undefined) {
    elements.sdEnabled.checked = Boolean(data.sd.enabled);
  }
  if (elements.sdCsPin && data.sd?.csPin !== undefined && [...elements.sdCsPin.options].some((option) => option.value === String(data.sd.csPin))) {
    elements.sdCsPin.value = String(data.sd.csPin);
  }
  if (elements.sdSckPin && data.sd?.sckPin !== undefined && [...elements.sdSckPin.options].some((option) => option.value === String(data.sd.sckPin))) {
    elements.sdSckPin.value = String(data.sd.sckPin);
  }
  if (elements.sdMosiPin && data.sd?.mosiPin !== undefined && [...elements.sdMosiPin.options].some((option) => option.value === String(data.sd.mosiPin))) {
    elements.sdMosiPin.value = String(data.sd.mosiPin);
  }
  if (elements.sdMisoPin && data.sd?.misoPin !== undefined && [...elements.sdMisoPin.options].some((option) => option.value === String(data.sd.misoPin))) {
    elements.sdMisoPin.value = String(data.sd.misoPin);
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
  syncPageSections(data);
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

function sdPinsConflictInternally(payload) {
  const enabled = Boolean(payload?.sd?.enabled ?? state.settings?.sd?.enabled ?? false);
  if (!enabled) {
    return false;
  }

  const pins = [
    Number(payload?.sd?.csPin ?? state.settings?.sd?.csPin ?? DEFAULT_SD_GPIO_PINS.cs),
    Number(payload?.sd?.sckPin ?? state.settings?.sd?.sckPin ?? DEFAULT_SD_GPIO_PINS.sck),
    Number(payload?.sd?.mosiPin ?? state.settings?.sd?.mosiPin ?? DEFAULT_SD_GPIO_PINS.mosi),
    Number(payload?.sd?.misoPin ?? state.settings?.sd?.misoPin ?? DEFAULT_SD_GPIO_PINS.miso),
  ];

  return new Set(pins).size !== pins.length;
}

function sdPinsConflictWithReservedFunctions(payload) {
  const enabled = Boolean(payload?.sd?.enabled ?? state.settings?.sd?.enabled ?? false);
  if (!enabled) {
    return false;
  }

  const sdPins = new Set([
    Number(payload?.sd?.csPin ?? state.settings?.sd?.csPin ?? DEFAULT_SD_GPIO_PINS.cs),
    Number(payload?.sd?.sckPin ?? state.settings?.sd?.sckPin ?? DEFAULT_SD_GPIO_PINS.sck),
    Number(payload?.sd?.mosiPin ?? state.settings?.sd?.mosiPin ?? DEFAULT_SD_GPIO_PINS.mosi),
    Number(payload?.sd?.misoPin ?? state.settings?.sd?.misoPin ?? DEFAULT_SD_GPIO_PINS.miso),
  ]);

  const reservedPins = new Set([
    Number(payload?.audio?.wsPin ?? state.settings?.audio?.wsPin ?? DEFAULT_ESP32S3_AUDIO_PINS.ws),
    Number(payload?.audio?.bclkPin ?? state.settings?.audio?.bclkPin ?? DEFAULT_ESP32S3_AUDIO_PINS.bclk),
    Number(payload?.audio?.doutPin ?? state.settings?.audio?.doutPin ?? DEFAULT_ESP32S3_AUDIO_PINS.dout),
    Number(payload?.battery?.adcPin ?? state.settings?.battery?.adcPin ?? 0),
    Number(payload?.battery?.chargingSensePin ?? state.settings?.battery?.chargingSensePin ?? 0),
    Number(payload?.device?.statusLedPin ?? state.settings?.device?.statusLedPin ?? 0),
  ].filter((pin) => Number.isFinite(pin) && pin >= 0));

  const displayType = String(payload?.oled?.displayType ?? state.settings?.oled?.displayType ?? "oled").toLowerCase();
  const wapeTriggerPin = Number(payload?.oled?.wapeTriggerPin ?? state.settings?.oled?.wapeTriggerPin ?? 0);
  if (displayType === "wape" && Number.isFinite(wapeTriggerPin) && wapeTriggerPin > 0) {
    reservedPins.add(wapeTriggerPin);
  }

  return [...sdPins].some((pin) => reservedPins.has(pin));
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
  const measuredVoltage = parseDecimalFieldValue(elements.batteryMeasuredVoltage, state.settings?.battery?.measuredVoltage || 0);
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
  const measuredVoltage = parseDecimalFieldValue(elements.batteryMeasuredVoltage, state.settings?.battery?.measuredVoltage || 0);
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
  payload.sd ||= {};
  payload.effects ||= {};

  payload.mqtt.port = Number(payload.mqtt.port || 1883);
  payload.device.savedVolumePercent = Number(elements.volumeSlider?.value || payload.device.savedVolumePercent || 5);
  payload.device.statusLedPin = Number(elements.statusLedPin?.value || payload.device.statusLedPin || state.settings?.device?.statusLedPin || 0);
  payload.device.audioMuted = Boolean(elements.audioMutedToggle?.checked ?? payload.device.audioMuted ?? true);
  payload.device.lowBatterySleepThresholdPercent = Number(payload.device.lowBatterySleepThresholdPercent || 20);
  payload.device.lowBatteryWakeIntervalMinutes = Number(payload.device.lowBatteryWakeIntervalMinutes || 0);
  payload.audio.doutPin = Number(elements.audioDoutPin?.value || payload.audio.doutPin || DEFAULT_ESP32S3_AUDIO_PINS.dout);
  payload.audio.wsPin = Number(elements.audioWsPin?.value || payload.audio.wsPin || DEFAULT_ESP32S3_AUDIO_PINS.ws);
  payload.audio.bclkPin = Number(elements.audioBclkPin?.value || payload.audio.bclkPin || DEFAULT_ESP32S3_AUDIO_PINS.bclk);
  payload.battery.measuredVoltage = parseDecimalFieldValue(elements.batteryMeasuredVoltage, payload.battery.measuredVoltage || 0);
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
  payload.sd.enabled = true;
  payload.sd.csPin = Number(elements.sdCsPin?.value || payload.sd.csPin || DEFAULT_SD_GPIO_PINS.cs);
  payload.sd.sckPin = Number(elements.sdSckPin?.value || payload.sd.sckPin || DEFAULT_SD_GPIO_PINS.sck);
  payload.sd.mosiPin = Number(elements.sdMosiPin?.value || payload.sd.mosiPin || DEFAULT_SD_GPIO_PINS.mosi);
  payload.sd.misoPin = Number(elements.sdMisoPin?.value || payload.sd.misoPin || DEFAULT_SD_GPIO_PINS.miso);
  payload.effects.startupFile = String(elements.effectStartupFile?.value || elements.effectStartupFile?.dataset?.savedEffectValue || payload.effects.startupFile || "");
  payload.effects.alarmFile = String(elements.effectAlarmFile?.value || elements.effectAlarmFile?.dataset?.savedEffectValue || payload.effects.alarmFile || "");
  payload.effects.notificationFile = String(elements.effectNotificationFile?.value || elements.effectNotificationFile?.dataset?.savedEffectValue || payload.effects.notificationFile || "");
  payload.effects.ambientSoundFile = String(elements.effectAmbientSoundFile?.value || elements.effectAmbientSoundFile?.dataset?.savedEffectValue || payload.effects.ambientSoundFile || "");
  payload.effects.lowBatteryFile = String(elements.effectLowBatteryFile?.value || elements.effectLowBatteryFile?.dataset?.savedEffectValue || payload.effects.lowBatteryFile || "");
  payload.effects.shutDownFile = String(elements.effectShutDownFile?.value || elements.effectShutDownFile?.dataset?.savedEffectValue || payload.effects.shutDownFile || "");
  payload.effects.updateAvailableFile = String(elements.effectUpdateAvailableFile?.value || elements.effectUpdateAvailableFile?.dataset?.savedEffectValue || payload.effects.updateAvailableFile || "");
  payload.effects.updateSuccessFile = String(elements.effectUpdateSuccessFile?.value || elements.effectUpdateSuccessFile?.dataset?.savedEffectValue || payload.effects.updateSuccessFile || "");
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

async function awaitPendingSettingsSave() {
  if (!state.settingsSavePromise) {
    return;
  }
  await state.settingsSavePromise;
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
  const usbPowered = numericVoltage > 4.5;
  const percent = estimateBatteryPercent(numericVoltage);
  const levelClass = batteryLevelClass(percent);
  const fillWidth = Math.max(8, percent);

  elements.batteryHero.className = "stat-value stat-value-battery";
  if (usbPowered) {
    elements.batteryHero.innerHTML = `
      <div class="battery-hero-widget battery-usb" aria-label="USB power connected">
        <div class="usb-hero-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M4.7 19.3 19 5"></path>
            <path d="m21 3-3 1 2 2Z"></path>
            <path d="M9.26 7.68 5 12l2 5"></path>
            <path d="m10 14 5 2 3.5-3.5"></path>
            <path d="m18 12 1-1 1 1-1 1Z"></path>
          </svg>
        </div>
        <div class="wifi-quality">USB Power</div>
        <div class="battery-meta">${numericVoltage.toFixed(2)} V</div>
      </div>
    `;
    return;
  }

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
  const previousStatus = state.status;
  state.status = status;
  const previewRef = state.storagePreviewItem ? storagePlaybackRef(state.storagePreviewItem.path, state.storagePreviewTarget) : "";
  const currentPlaybackUrl = String(status?.playback?.url || "");
  const wasDeviceActive = Boolean(state.storagePreviewPlaybackMode.deviceActive);
  const isDeviceActive = Boolean(previewRef && currentPlaybackUrl === previewRef && isPlaybackActive(status));
  state.storagePreviewPlaybackMode.previousDeviceActive = wasDeviceActive;
  state.storagePreviewPlaybackMode.deviceActive = isDeviceActive;
  if (wasDeviceActive && !isDeviceActive && previewRef && !state.storagePreviewPlaybackMode.suppressAutoAdvance) {
    advanceStoragePreviewTrack(1, { autoplayDevice: true, respectModes: true }).catch(handleError);
  }
  if (!isDeviceActive && state.storagePreviewPlaybackMode.suppressAutoAdvance) {
    state.storagePreviewPlaybackMode.suppressAutoAdvance = false;
  }
  const playbackWasActive = isPlaybackActive(previousStatus);
  const playbackIsActive = isPlaybackActive(status);
  if (playbackWasActive && !playbackIsActive) {
    if (state.deferredStorageReload && activeTabName() === "storage-external") {
      window.setTimeout(() => {
        refreshExternalStorageTab().catch(handleError);
      }, 50);
    }
    if (state.deferredEffectsReload && activeTabName() === "effects") {
      window.setTimeout(() => {
        loadEffectFileOptions().catch(handleError);
      }, 50);
    }
  }
  updateGpioBoardSelectorMode(status);
  updateStorageAvailabilityUi(status);
  const device = status?.device || {};
  const network = status?.network || {};
  const playback = status?.playback || {};
  const battery = status?.battery || {};
  const firmware = status?.firmware || {};
  const settings = status?.settings || {};
  populateStatusLedPinOptions();
  populateSdPinOptions();
  populateBatteryAdcPinOptions();
  populateWapeTriggerPinOptions();
  maybeRedirectToStationIp(status);
  const ota = status.otaManager || status.ota || {};
  const wifiConnected = Boolean(network.wifiConnected);
  const mqttConnected = Boolean(network.mqttConnected);
  const playbackActive = playback.state === "playing";
  const savedVolumePercent = Number(state.settings?.device?.savedVolumePercent ?? playback.volumePercent ?? 0);

  elements.deviceTitle.textContent = device.friendlyName || "ESP32 Notifier";
  elements.deviceNameValue.textContent = device.deviceName || "-";

  elements.ipAddress.textContent = network.ip || "-";
  elements.apInfo.textContent = network.apMode ? `${network.apSsid || "AP active"}` : "Disabled";
  elements.wifiRssi.textContent = wifiConnected ? `${network.wifiRssi} dBm` : "-";
  elements.mqttStatus.textContent = mqttConnected ? "Connected" : "Disconnected";
  elements.firmwareVersion.textContent = `${firmware.version || "-"} (${firmware.buildDate || "-"})`;
  setCurrentFirmwareVersion(firmware.version);
  setFirmwareAuthorLink(settings);
  elements.batteryVoltage.textContent = `${Number(battery.voltage || 0).toFixed(3)} V`;
  elements.batteryRaw.textContent = `${battery.rawAdc ?? "-"} / ${Number(battery.rawAdcVoltage || 0).toFixed(3)} V`;
  updateDerivedBatteryCalibration();
  elements.freeHeap.textContent = formatBytes(status.system.freeHeap || status.system?.sram?.freeBytes || 0);
  elements.settingsSource.textContent = settings.usingSaved ? "Saved settings" : "Hardwired defaults";
  elements.playbackState.textContent = playback.state || "idle";
  const currentTitle = normalizePlaybackTitle(playback.title, playback.url) || "Idle";
  elements.currentTitle.textContent = currentTitle;
  elements.currentTitle.title = currentTitle;
  elements.currentUrl.value = playback.url || "";
  elements.currentUrl.title = playback.url || "";
  if (document.activeElement !== elements.volumeSlider) {
    elements.volumeSlider.value = savedVolumePercent;
  }
  if (document.activeElement !== elements.storagePreviewVolumeSlider && elements.storagePreviewVolumeSlider) {
    elements.storagePreviewVolumeSlider.value = savedVolumePercent;
  }
  elements.volumeValue.textContent = `${document.activeElement === elements.volumeSlider ? elements.volumeSlider.value : savedVolumePercent}%`;
  if (elements.storagePreviewVolumeValue) {
    elements.storagePreviewVolumeValue.textContent = `${document.activeElement === elements.storagePreviewVolumeSlider ? elements.storagePreviewVolumeSlider.value : savedVolumePercent}%`;
  }
  const audioMuted = Boolean(elements.audioMutedToggle?.checked);
  const audioEnabled = Boolean(firmware.audioEnabled);

  updatePlaybackActionButton();
  updateAudioUiState();

  renderWifiHero(wifiConnected, network.ip || (network.apMode ? "192.168.4.1" : "No IP"), network.wifiRssi);
  setPill(elements.mqttPill, mqttConnected ? "MQTT Connected" : "MQTT Offline", mqttConnected ? "ok" : "warn");
  renderPlaybackHero(status, audioMuted);
  renderBatteryHero(battery.voltage || 0);
  renderHardwareSummary(status);
  renderDeviceResources(status);
  maybeRefreshVisibleStorageTab();
  renderGpioOverview();
  updateStoragePreviewProgressUi();

  const previousUpdateVersion = String(previousStatus?.ota?.latestVersion || previousStatus?.otaManager?.latestVersion || "");
  const currentUpdateVersion = String(status?.ota?.latestVersion || ota.latestVersion || "");
  if (Boolean(status?.ota?.updateAvailable) && currentUpdateVersion && currentUpdateVersion !== previousUpdateVersion) {
    showUpdateAvailablePopup(status);
  }

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
      setMqttConnectStatus(`Connected to ${state.settings?.mqtt?.host || namedField("mqtt.host")?.value || "broker"}`);
    } else if (!wifiConnected) {
      setMqttConnectStatus("Waiting for Wi-Fi before MQTT can connect...");
    } else {
      setMqttConnectStatus("Connecting to MQTT broker...");
    }
  }

  if (state.wifiConnectInProgress) {
    if (wifiConnected) {
      setScanStatus(`Connected to ${network.ssid || namedField("wifi.ssid")?.value || "Wi-Fi"}`);
    } else {
      setScanStatus("Connecting to Wi-Fi...");
    }
  }

  updateWifiActionButton();
  updateMqttActionButton();
  updateStoragePreviewPlaybackControls();
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
  const playbackActive = isPlaybackActive();
  const audioEnabled = Boolean(state.status?.firmware?.audioEnabled);

  if (playbackActionInProgress === "play") {
    elements.playbackActionButton.textContent = "Starting...";
    elements.playbackActionButton.classList.remove("secondary");
    elements.playbackActionButton.disabled = true;
    elements.playbackActionButton.title = "Waiting for playback to start";
    updatePlaybackHeroControls();
    return;
  }

  if (playbackActionInProgress === "stop") {
    elements.playbackActionButton.textContent = "Stopping...";
    elements.playbackActionButton.classList.add("secondary");
    elements.playbackActionButton.disabled = true;
    elements.playbackActionButton.title = "Waiting for playback to stop";
    updatePlaybackHeroControls();
    return;
  }

  elements.playbackActionButton.textContent = playbackActive ? "Stop" : "Play";
  elements.playbackActionButton.classList.toggle("secondary", playbackActive);
  elements.playbackActionButton.disabled = !audioEnabled;
  elements.playbackActionButton.title = audioEnabled ? "" : "Audio playback is disabled in this firmware build";
  updatePlaybackHeroControls();
}

function setupTabs() {
  const buttons = [...document.querySelectorAll(".tab-button")];
  const panels = [...document.querySelectorAll(".tab-panel")];
  const activateTab = (tabName) => {
    const resolvedTabName = buttons.some((button) => button.dataset.tab === tabName && !button.hidden && !button.disabled)
      ? tabName
      : (buttons.find((button) => !button.hidden && !button.disabled)?.dataset.tab || "info");
    for (const button of buttons) {
      const isActive = button.dataset.tab === resolvedTabName;
      button.setAttribute("aria-selected", String(isActive));
    }
    for (const panel of panels) {
      panel.classList.toggle("active", panel.id === `tab-${resolvedTabName}` && !panel.hidden);
    }
    try {
      window.localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, resolvedTabName);
    } catch {
    }

    if (resolvedTabName === "firmware") {
      refreshFirmwareInfo(true).catch(handleError);
    }

    if (resolvedTabName === "effects" && state.settings) {
      syncEffectsPage(state.settings);
    }

  if (resolvedTabName === "storage-external") {
      maybeRefreshVisibleStorageTab(true);
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
  if (state.storageUploadInProgress || state.statusRequestInFlight) {
    return state.status;
  }

  state.statusRequestInFlight = true;
  try {
    const status = await request(`/api/status?ts=${Date.now()}`);
    renderStatus(status);
    if (elements.rebootOverlay && !elements.rebootOverlay.hidden) {
      if (!state.rebootOverlayArmed) {
        hideRebootOverlay();
        return status;
      }
      const reconnectGraceElapsed = !state.rebootOverlayReconnectAllowedAt || Date.now() >= state.rebootOverlayReconnectAllowedAt;
      if (state.rebootOverlaySawDisconnect || reconnectGraceElapsed) {
        clearFirmwareReconnectState();
      }
    }
    return status;
  } finally {
    state.statusRequestInFlight = false;
  }
}

function startStatusPolling(intervalMs = 2000) {
  if (state.statusPollTimer) {
    return;
  }

  state.statusPollTimer = window.setInterval(() => {
    loadStatus().catch((error) => console.error(error));
  }, intervalMs);
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
  state.settings.sd ||= {};
  state.settings.sd.enabled = true;
  state.batteryMeasuredVoltageInput = Number(state.settings?.battery?.measuredVoltage || 0) > 0
    ? Number(state.settings.battery.measuredVoltage).toFixed(3)
    : "";
  fillForm(state.settings);
  setFirmwareAuthorLink(state.settings);
  renderGpioOverview();
  resetWifiNetworkList();
  maybeRefreshVisibleStorageTab();
}

async function saveSettings(options = {}) {
  const { silent = false } = options;
  if (state.settingsLoading) {
    return;
  }
  if (state.settingsSaving) {
    await awaitPendingSettingsSave();
    if (state.settingsDirty) {
      return saveSettings(options);
    }
    return;
  }
  if (state.settingsSaveTimer) {
    window.clearTimeout(state.settingsSaveTimer);
    state.settingsSaveTimer = null;
  }
  normalizeDecimalField(elements.batteryMeasuredVoltage);
  const previousSettings = state.settings;
  const submittedSettings = collectForm();
  if (oledPinsConflictInternally(submittedSettings)) {
    throw new Error("OLED SDA, SCL, and RESET must use different GPIOs.");
  }
  if (oledPinsConflictWithAudio(submittedSettings)) {
    throw new Error("OLED SDA, SCL, and RESET cannot reuse the active MAX98357A I2S pins. Change the display pins or disable OLED first.");
  }
  if (sdPinsConflictInternally(submittedSettings)) {
    throw new Error("SD card CS, SCK, MOSI, and MISO must use four different GPIOs.");
  }
  if (sdPinsConflictWithReservedFunctions(submittedSettings)) {
    throw new Error("SD card pins cannot reuse the active audio, battery, status LED, or Wape trigger GPIOs.");
  }
  if (!silent) {
    setMessage("Saving settings...");
  }
  state.settingsSaving = true;
  const savePromise = (async () => {
    try {
      await request("/api/settings", {
        method: "POST",
        body: JSON.stringify(submittedSettings),
      });

      state.settings = submittedSettings;
      state.batteryMeasuredVoltageInput = submittedSettings.battery?.measuredVoltage > 0
        ? Number(submittedSettings.battery.measuredVoltage).toFixed(3)
        : "";
      fillForm(submittedSettings);
      renderEffectFileOptions(submittedSettings);
      state.settingsDirty = false;
      setMessage(silent ? "Settings auto-saved" : "Settings saved");
      if (!silent) {
        toast("Settings saved");
      }

      loadStatus().catch((error) => console.error(error));
      refreshSettingsAfterSave(submittedSettings).catch((error) => console.error(error));
      if (sdSettingsChanged(previousSettings, submittedSettings)) {
        clearEffectFileOptionsCache();
        renderEffectFileOptions(submittedSettings);
      }
      if (activeTabName() === "storage-external") {
        if (state.activeStorageTarget === "sd") {
          refreshExternalStorageTab(state.currentStoragePathByTarget.sd || "/").catch((error) => console.error(error));
        } else {
          refreshStorageManager(state.activeStorageTarget).catch((error) => console.error(error));
        }
      }
    } finally {
      state.settingsSaving = false;
      if (state.settingsSavePromise === savePromise) {
        state.settingsSavePromise = null;
      }
    }
  })();
  state.settingsSavePromise = savePromise;
  await savePromise;
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

  const playbackActive = isPlaybackActive();

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

async function shutdownServer() {
  await request("/api/server-shutdown", { method: "POST", body: JSON.stringify({}) });
  setMessage("Web UI locked. Use MQTT payload 'unlock' on <baseTopic>/cmd/web_ui to restore access.");
  toast("Web UI locked");
}

async function requestDeviceRestart(path, {
  title = "Rebooting device...",
  message = "Reboot requested",
  totalSeconds = 30,
} = {}) {
  if (state.settingsDirty) {
    await saveSettings({ silent: true });
  }
  await awaitPendingSettingsSave();
  state.rebootOverlayArmed = true;
  showRebootOverlay(title, totalSeconds);
  try {
    await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
      cache: "no-store",
    });
  } catch {
    // The device may drop the HTTP response while rebooting.
  }
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

async function copyStorageUrl(path) {
  const url = `${window.location.origin}${storageStreamUrl(path)}`;
  await navigator.clipboard.writeText(url);
  setStorageStatus(`Copied URL for ${path}`);
  toast("File URL copied");
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
elements.playbackPrevButton?.addEventListener("click", () => stepRadioStationSelection(-1).catch(handleError));
elements.playbackHeroToggleButton?.addEventListener("click", () => handlePlaybackAction().catch(handleError));
elements.playbackNextButton?.addEventListener("click", () => stepRadioStationSelection(1).catch(handleError));
elements.playbackActionButton?.addEventListener("click", () => handlePlaybackAction().catch(handleError));
document.getElementById("copyUrlButton").addEventListener("click", () => copyCurrentUrl().catch(handleError));
document.getElementById("checkOtaButton").addEventListener("click", () => checkOta().catch(handleError));
document.getElementById("applyOtaButton").addEventListener("click", () => installSelectedFirmware().catch(handleError));
elements.mqttConnectButton?.addEventListener("click", () => connectMqtt().catch(handleError));
elements.updateAvailableCloseButton?.addEventListener("click", closeUpdateAvailablePopup);
elements.updateAvailableDialog?.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeUpdateAvailablePopup();
});
elements.displayTriggerButton?.addEventListener("click", () => triggerDisplay().catch(handleError));
elements.saveDeviceButton?.addEventListener("click", () => saveSettings({ silent: false }).catch(handleError));
elements.deviceSpiffsCard?.addEventListener("click", () => {
  if (!flashStorageAvailable()) {
    return;
  }
  activateTabByName("storage-internal");
});
document.getElementById("uploadFirmwareButton").addEventListener("click", () => {
  elements.localFirmwareFile.value = "";
  updateLocalFirmwareLabel();
  elements.localFirmwareFile.click();
});
document.getElementById("rebootButton").addEventListener("click", async () => {
  await requestDeviceRestart("/api/reboot", {
    title: "Rebooting device...",
    message: "Reboot requested",
    totalSeconds: 30,
  });
});
document.getElementById("factoryResetButton").addEventListener("click", async () => {
  if (!window.confirm("Erase saved settings and reboot?")) {
    return;
  }
  await requestDeviceRestart("/api/factory-reset", {
    title: "Factory reset in progress...",
    message: "Factory reset requested",
    totalSeconds: 35,
  });
});
elements.localFirmwareFile?.addEventListener("change", () => {
  updateLocalFirmwareLabel();
  if (elements.localFirmwareFile.files && elements.localFirmwareFile.files[0]) {
    uploadLocalFirmware().catch(handleError);
  }
});
elements.storageUpButton?.addEventListener("click", () => {
  const parentPath = storageParentPath(state.currentStoragePathByTarget[state.activeStorageTarget] || "/");
  if (parentPath) {
    openStorageManager(state.activeStorageTarget, parentPath).catch(handleError);
  }
});
elements.storageReindexButton?.addEventListener("click", () => {
  reindexStorageDirectory(
    state.activeStorageTarget,
    state.currentStoragePathByTarget[state.activeStorageTarget] || "/"
  ).catch(handleError);
});
elements.storageSelectModeButton?.addEventListener("click", () => {
  setStorageSelectionMode(!state.storageSelectionMode);
});
elements.storageSelectAllButton?.addEventListener("click", () => {
  if (!state.storageSelectionMode) {
    setStorageSelectionMode(true);
  }
  selectAllStorageEntries();
});
elements.storageDeleteButton?.addEventListener("click", () => {
  deleteSelectedStorageItems().catch(handleError);
});
elements.storagePlayButton?.addEventListener("click", () => {
  const entry = selectedStoragePlaybackEntry();
  if (!entry) {
    setStorageStatus("Select one audio file first.", true);
    return;
  }
  queueStoragePlayback(entry, state.activeStorageTarget).catch(handleError);
});
elements.storageNewFolderButton?.addEventListener("click", () => createStorageFolder().catch(handleError));
elements.storageUploadButton?.addEventListener("click", () => {
  elements.storageFileInput.value = "";
  elements.storageFileInput.click();
});
elements.storageFileInput?.addEventListener("change", () => {
  if (elements.storageFileInput.files && elements.storageFileInput.files[0]) {
    uploadStorageFile().catch(handleError);
  }
});
elements.headerActionsButton?.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  setHeaderActionsMenuOpen(!state.headerActionsMenuOpen);
});
elements.headerRefreshButton?.addEventListener("click", (event) => {
  event.preventDefault();
  setHeaderActionsMenuOpen(false);
  performFrontendHardRefresh();
});
elements.headerRebootButton?.addEventListener("click", (event) => {
  event.preventDefault();
  requestDeviceRestart("/api/reboot", {
    title: "Rebooting device...",
    message: "Reboot requested",
    totalSeconds: 30,
  }).catch(handleError);
});
elements.headerShutdownButton?.addEventListener("click", (event) => {
  event.preventDefault();
  setHeaderActionsMenuOpen(false);
  const mqttConfigured = Boolean(state.settings?.mqtt?.host && String(state.settings.mqtt.host).trim());
  const mqttConnected = Boolean(state.status?.network?.mqttConnected);
  if (!mqttConfigured || !mqttConnected) {
    const reason = !mqttConfigured
      ? "MQTT is not configured."
      : "MQTT is not connected right now.";
    const message = `${reason} Web UI lock is blocked because you would not be able to unlock the device remotely. Configure and connect MQTT first.`;
    setMessage(message, true);
    toast(message);
    return;
  }
  if (!window.confirm("Lock the web interface now?\n\nThis device is remote. Once locked, the web UI will become unavailable until you either unlock it over MQTT with payload 'unlock' on <baseTopic>/cmd/web_ui, or physically reboot/reset the device.\n\nWi-Fi and MQTT will stay running.")) {
    return;
  }
  shutdownServer().catch(handleError);
});
document.addEventListener("click", (event) => {
  if (!state.headerActionsMenuOpen) {
    return;
  }
  const target = event.target;
  if (elements.headerActionsButton?.contains(target) || elements.headerActionsMenu?.contains(target)) {
    return;
  }
  setHeaderActionsMenuOpen(false);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.headerActionsMenuOpen) {
    setHeaderActionsMenuOpen(false);
  }
});
window.addEventListener("pageshow", () => {
  resetTransientOverlays();
});
window.addEventListener("load", () => {
  resetTransientOverlays();
});
window.addEventListener("beforeunload", () => {
  hideRebootOverlay();
});
elements.storageFileList?.addEventListener("click", (event) => {
  const checkbox = event.target.closest("[data-storage-checkbox]");
  if (checkbox) {
    return;
  }

  const row = event.target.closest(".storage-file-row");
  if (!row) {
    return;
  }

  const path = row.dataset.storagePath || "";
  if (!path) {
    return;
  }

  if (state.storageClickTimer) {
    window.clearTimeout(state.storageClickTimer);
    state.storageClickTimer = null;
  }

  state.storageClickTimer = window.setTimeout(() => {
    toggleStorageSelection(path, { additive: state.storageSelectionMode });
    state.storageClickTimer = null;
  }, state.storageSelectionMode ? 0 : 380);
});
elements.storageFileList?.addEventListener("change", (event) => {
  const checkbox = event.target.closest("[data-storage-checkbox]");
  if (!checkbox) {
    return;
  }
  toggleStorageSelection(checkbox.dataset.storageCheckbox, { additive: true });
});
elements.storageFileList?.addEventListener("dblclick", (event) => {
  const row = event.target.closest(".storage-file-row");
  if (!row) {
    return;
  }

  const path = row.dataset.storagePath || "";
  const kind = row.dataset.storageKind || "file";
  const entry = activeStorageEntries().find((candidate) => candidate.path === path);
  if (!entry) {
    return;
  }

  if (state.storageClickTimer) {
    window.clearTimeout(state.storageClickTimer);
    state.storageClickTimer = null;
  }

  if (kind === "folder") {
    clearStorageSelection();
    openStorageManager(state.activeStorageTarget, path).catch(handleError);
    return;
  }

  openStoragePreview(entry).catch(handleError);
});
elements.storageFileList?.addEventListener("scroll", () => {
  const node = elements.storageFileList;
  if (!node) {
    return;
  }
  if (node.scrollTop + node.clientHeight >= node.scrollHeight - 160) {
    loadMoreStorageEntries(state.activeStorageTarget).catch(handleError);
  }
});
elements.storageBreadcrumbs?.addEventListener("click", (event) => {
  const crumbButton = event.target.closest("[data-storage-nav]");
  if (!crumbButton) {
    return;
  }
  clearStorageSelection();
  openStorageManager(state.activeStorageTarget, crumbButton.dataset.storageNav).catch(handleError);
});
elements.storagePreviewPlayButton?.addEventListener("click", () => {
  toggleStoragePreviewPlayback().catch(handleError);
});
elements.storagePreviewPrevButton?.addEventListener("click", () => {
  advanceStoragePreviewTrack(-1, {
    autoplayDevice: state.storagePreviewPlaybackMode.deviceActive,
    respectModes: false,
  }).catch(handleError);
});
elements.storagePreviewNextButton?.addEventListener("click", () => {
  advanceStoragePreviewTrack(1, {
    autoplayDevice: state.storagePreviewPlaybackMode.deviceActive,
    respectModes: false,
  }).catch(handleError);
});
elements.storagePreviewLoopButton?.addEventListener("click", () => {
  state.storagePreviewPlaybackMode.loop = !state.storagePreviewPlaybackMode.loop;
  updateStoragePreviewPlaybackControls();
});
elements.storagePreviewShuffleButton?.addEventListener("click", () => {
  state.storagePreviewPlaybackMode.shuffle = !state.storagePreviewPlaybackMode.shuffle;
  updateStoragePreviewPlaybackControls();
});
elements.storagePreviewCloseButton?.addEventListener("click", () => {
  closeStoragePreview();
});
elements.storagePreviewModal?.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeStoragePreview();
});

elements.playForm.addEventListener("submit", (event) => handlePlaybackAction(event).catch(handleError));
elements.radioCountrySelect?.addEventListener("change", (event) => {
  loadRadioStations(event.target.value).catch(handleError);
});
elements.radioStationSelect?.addEventListener("change", () => {
  applySelectedRadioStation({ autoPlay: true }).catch(handleError);
});
elements.gpioBoardSelector?.addEventListener("change", updateGpioBoardImage);
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
elements.storagePreviewVolumeSlider?.addEventListener("change", (event) => setVolume(Number(event.target.value)).catch(handleError));
elements.volumeSlider.addEventListener("input", (event) => {
  elements.volumeValue.textContent = `${event.target.value}%`;
});
elements.storagePreviewVolumeSlider?.addEventListener("input", (event) => {
  if (elements.storagePreviewVolumeValue) {
    elements.storagePreviewVolumeValue.textContent = `${event.target.value}%`;
  }
});
elements.batteryAdcPin?.addEventListener("change", () => {
  populateSdPinOptions();
  populateOledPinOptions();
  populateWapeTriggerPinOptions();
  updateBatteryUi();
  queueSettingsSave(0);
});
for (const field of [elements.audioWsPin, elements.audioBclkPin, elements.audioDoutPin]) {
  field?.addEventListener("change", () => {
    updateAudioI2sUi();
    updateAudioUiState();
    populateSdPinOptions();
    populateBatteryAdcPinOptions();
    populateOledPinOptions();
    populateWapeTriggerPinOptions();
    updateBatteryUi();
    state.settingsDirty = true;
  });
}
for (const { label, element } of effectSelectElements()) {
  const ensureEffectOptionsLoaded = () => {
    if (state.effectFilesLoading || state.effectFileOptionsLoaded) {
      return;
    }
    loadEffectFileOptions().catch(handleError);
  };
  element?.addEventListener("pointerdown", ensureEffectOptionsLoaded);
  element?.addEventListener("focus", ensureEffectOptionsLoaded);
  element?.addEventListener("change", async () => {
    const selectedValue = String(element.value || "").trim();
    const isAmbientSelection = element.id === "effectAmbientSoundFile";
    element.dataset.savedEffectValue = selectedValue;
    state.settingsDirty = true;
    try {
      await saveSettings({ silent: true });
      if (selectedValue) {
        await previewEffectFile(
          selectedValue,
          isAmbientSelection ? "Ambient Sound" : `${label} preview`,
          { ambient: isAmbientSelection },
        );
      }
    } catch (error) {
      handleError(error);
    }
  });
}
elements.effectsReindexButton?.addEventListener("click", () => {
  reindexEffectsFiles().catch(handleError);
});
for (const field of [elements.sdEnabled, elements.sdCsPin, elements.sdSckPin, elements.sdMosiPin, elements.sdMisoPin]) {
  field?.addEventListener("change", () => {
    populateSdPinOptions();
    populateStatusLedPinOptions();
    populateBatteryAdcPinOptions();
    populateOledPinOptions();
    populateWapeTriggerPinOptions();
    updateBatteryUi();
    renderDeviceResources(state.status || {});
  });
}
elements.displayType?.addEventListener("change", () => {
  updateDisplayModeUi();
  populateOledPinOptions();
  populateWapeTriggerPinOptions();
  renderOledPreview();
  renderGpioOverview();
});
elements.gpioBoardAutodetect?.addEventListener("change", async () => {
  if (elements.gpioBoardAutodetect?.checked) {
    try {
      const status = await loadStatus();
      updateGpioBoardSelectorMode(status);
    } catch (error) {
      handleError(error);
      return;
    }
  } else {
    updateGpioBoardSelectorMode(state.status);
  }
  updateGpioBoardImage();
});
elements.gpioExtraToggle?.addEventListener("click", () => {
  const expanded = elements.gpioExtraToggle?.getAttribute("aria-expanded") === "true";
  setGpioExtraExpanded(!expanded);
});
for (const gpioColumn of [elements.gpioLeftPins, elements.gpioRightPins, elements.gpioExtraLeftPins, elements.gpioExtraRightPins]) {
  gpioColumn?.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement) || !target.matches("[data-gpio-role-select]")) {
      return;
    }
    applyGpioRoleSelection(target.dataset.pin, target.value);
  });
}
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
  state.batteryMeasuredVoltageInput = event.target.value;
  updateDerivedBatteryCalibration();
  queueSettingsSave();
});
elements.batteryMeasuredVoltage?.addEventListener("blur", (event) => {
  normalizeDecimalField(event.target);
  state.batteryMeasuredVoltageInput = event.target.value;
  updateDerivedBatteryCalibration();
  if (state.settingsDirty) {
    saveSettings({ silent: true }).catch(handleError);
  }
});
elements.batteryMeasuredVoltage?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") {
    return;
  }
  event.preventDefault();
  normalizeDecimalField(event.target);
  state.batteryMeasuredVoltageInput = event.target.value;
  updateDerivedBatteryCalibration();
  state.settingsDirty = true;
  saveSettings({ silent: true }).catch(handleError);
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
      populateSdPinOptions();
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

resetTransientOverlays();
setupTabs();
setupPasswordToggles();
renderRecentPlayback();
updateWifiActionButton();
populateButtonActionSelects();
renderOledPreview();
updateGpioBoardSelectorMode(state.status);
updateGpioBoardImage();
loadRadioCountries().catch(handleError);

Promise.all([loadStatus(), loadSettings()]).catch(handleError);
startStatusPolling();
