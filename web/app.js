const state = {
  status: null,
  settings: null,
  storageInfoByTarget: {},
  currentStorageEntriesByTarget: { flash: [], sd: [] },
  currentStoragePathByTarget: { flash: "/", sd: "/" },
  activeStorageTarget: "flash",
  storageSelectionMode: false,
  storageSelectedPathsByTarget: { flash: [], sd: [] },
  storagePreviewItem: null,
  storagePreviewAudio: null,
  storagePreviewObjectUrl: "",
  storagePreviewArtworkUrl: "",
  storagePreviewRequestId: 0,
  storageClickTimer: null,
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
  storageUploadInProgress: false,
  stationRedirectInProgress: false,
  oledPreviewScrollTimer: null,
  oledPreviewScrollSignature: "",
  oledPreviewScrollOffset: 0,
};

const SETTINGS_AUTOSAVE_DELAY_MS = 900;
const ACTIVE_TAB_STORAGE_KEY = "notifierActiveTab";
const RADIO_SELECTION_STORAGE_KEY = "notifierRadioSelection";
const STORAGE_AUDIO_EXTENSIONS = new Set(["mp3", "wav", "aac", "m4a", "ogg", "opus", "flac"]);
const DEFAULT_RADIO_SELECTION = {
  country: "Azerbaijan",
  stationName: "AvtoFM",
  stationUrl: "",
};
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
  storageSelectModeButton: document.getElementById("storageSelectModeButton"),
  storageSelectAllButton: document.getElementById("storageSelectAllButton"),
  storageDeleteButton: document.getElementById("storageDeleteButton"),
  storageUploadButton: document.getElementById("storageUploadButton"),
  storageFileInput: document.getElementById("storageFileInput"),
  storageProgressFill: document.getElementById("storageProgressFill"),
  storageProgressLabel: document.getElementById("storageProgressLabel"),
  storageFileList: document.getElementById("storageFileList"),
  storagePreviewModal: document.getElementById("storagePreviewModal"),
  storagePreviewCloseButton: document.getElementById("storagePreviewCloseButton"),
  storagePreviewTitle: document.getElementById("storagePreviewTitle"),
  storagePreviewMeta: document.getElementById("storagePreviewMeta"),
  storagePreviewAlbum: document.getElementById("storagePreviewAlbum"),
  storagePreviewArtwork: document.getElementById("storagePreviewArtwork"),
  storagePreviewArtworkFallback: document.getElementById("storagePreviewArtworkFallback"),
  storagePreviewProgressFill: document.getElementById("storagePreviewProgressFill"),
  storagePreviewProgressLabel: document.getElementById("storagePreviewProgressLabel"),
  storagePreviewPlayButton: document.getElementById("storagePreviewPlayButton"),
  storagePreviewStopButton: document.getElementById("storagePreviewStopButton"),
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

async function refreshExternalStorageTab(directoryPath = state.currentStoragePathByTarget.sd || "/") {
  state.activeStorageTarget = "sd";
  state.currentStoragePathByTarget.sd = normalizeStorageDirectoryPath(directoryPath);
  setStorageStatus("Loading files...");
  const payload = await refreshStorageManager("sd", directoryPath);
  if (elements.storageProgressFill) {
    elements.storageProgressFill.style.width = "0%";
  }
  if (elements.storageProgressLabel) {
    elements.storageProgressLabel.textContent = "Idle";
  }
  setStorageStatus("Ready");
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
  const enabled = Boolean(elements.sdEnabled?.checked ?? settings?.sd?.enabled ?? false);
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

function rerenderStorageManager(target = state.activeStorageTarget) {
  renderStorageManager({
    target,
    storage: state.storageInfoByTarget[target] || {},
    currentPath: state.currentStoragePathByTarget[target] || "/",
    entries: activeStorageEntries(target),
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
  const allVisibleSelected = entries.length > 0 && entries.every((entry) => selectedPaths.includes(entry.path));

  if (elements.storageSelectModeButton) {
    elements.storageSelectModeButton.classList.toggle("active", state.storageSelectionMode);
    elements.storageSelectModeButton.querySelector("span").textContent = state.storageSelectionMode ? "Done" : "Select";
  }
  if (elements.storageSelectAllButton) {
    elements.storageSelectAllButton.disabled = !storage.mounted || entries.length === 0;
    elements.storageSelectAllButton.querySelector("span").textContent = allVisibleSelected ? "Clear" : "All";
  }
  if (elements.storageDeleteButton) {
    elements.storageDeleteButton.disabled = selectedPaths.length === 0;
    elements.storageDeleteButton.querySelector("span").textContent = selectedPaths.length > 1 ? `Delete (${selectedPaths.length})` : "Delete";
  }
  if (elements.storageUploadButton) {
    elements.storageUploadButton.disabled = !storage.mounted || state.storageUploadInProgress;
  }
  if (elements.storageNewFolderButton) {
    elements.storageNewFolderButton.disabled = !storage.mounted;
  }
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

function ensureStoragePreviewAudio() {
  if (state.storagePreviewAudio) {
    return state.storagePreviewAudio;
  }

  const audio = new Audio();
  audio.preload = "metadata";
  const syncProgress = () => {
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    const currentTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    const percent = duration > 0 ? Math.max(0, Math.min(100, (currentTime / duration) * 100)) : 0;
    if (elements.storagePreviewProgressFill) {
      elements.storagePreviewProgressFill.style.width = `${percent}%`;
    }
    if (elements.storagePreviewProgressLabel) {
      elements.storagePreviewProgressLabel.textContent = `${formatPlaybackClock(currentTime)} / ${formatPlaybackClock(duration)}`;
    }
  };

  audio.addEventListener("loadedmetadata", syncProgress);
  audio.addEventListener("timeupdate", syncProgress);
  audio.addEventListener("ended", syncProgress);
  audio.addEventListener("pause", syncProgress);
  state.storagePreviewAudio = audio;
  return audio;
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

function resetStoragePreviewUi() {
  if (elements.storagePreviewArtwork) {
    elements.storagePreviewArtwork.hidden = true;
    elements.storagePreviewArtwork.removeAttribute("src");
  }
  if (elements.storagePreviewArtworkFallback) {
    elements.storagePreviewArtworkFallback.hidden = false;
  }
  if (elements.storagePreviewProgressFill) {
    elements.storagePreviewProgressFill.style.width = "0%";
  }
  if (elements.storagePreviewProgressLabel) {
    elements.storagePreviewProgressLabel.textContent = "00:00 / 00:00";
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

function renderStorageBreadcrumbs(currentPath) {
  if (!elements.storageBreadcrumbs || !elements.storageUpButton) {
    return;
  }

  const normalized = normalizeStorageDirectoryPath(currentPath);
  const segments = normalized.split("/").filter(Boolean);
  const crumbs = [{ label: "Root", path: "/" }];
  let runningPath = "";
  for (const segment of segments) {
    runningPath += `/${segment}`;
    crumbs.push({ label: segment, path: runningPath });
  }

  elements.storageBreadcrumbs.innerHTML = crumbs.map((crumb, index) => (
    `<button type="button" class="storage-crumb" data-storage-nav="${escapeHtml(crumb.path)}">${escapeHtml(crumb.label)}</button>${index < crumbs.length - 1 ? '<span class="storage-crumb-sep">/</span>' : ''}`
  )).join("");
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
  const audio = ensureStoragePreviewAudio();
  audio.pause();
  audio.currentTime = 0;
  releaseStoragePreviewUrls();
  state.storagePreviewItem = null;
  resetStoragePreviewUi();
  if (elements.storagePreviewMeta) {
    elements.storagePreviewMeta.textContent = "Select a track to preview it.";
  }
  if (elements.storagePreviewAlbum) {
    elements.storagePreviewAlbum.textContent = "Album art unavailable";
  }
  if (elements.storagePreviewModal?.open) {
    elements.storagePreviewModal.close();
  }
}

async function playStoragePreviewOnDevice() {
  const entry = state.storagePreviewItem;
  if (!entry) {
    return;
  }

  const audio = ensureStoragePreviewAudio();
  const payload = {
    url: `${window.location.origin}${storageStreamUrl(entry.path, state.activeStorageTarget, false)}`,
    label: normalizePlaybackTitle(entry.name || entry.path, entry.path),
    type: "media",
  };

  await request("/api/play", { method: "POST", body: JSON.stringify(payload) });
  state.recentPlayback.unshift(payload);
  state.recentPlayback = state.recentPlayback.filter((item, index, array) => index === array.findIndex((candidate) => candidate.url === item.url && candidate.type === item.type));
  saveRecentPlayback();
  renderRecentPlayback();

  if (state.storagePreviewObjectUrl) {
    audio.src = state.storagePreviewObjectUrl;
  }
  try {
    await audio.play();
  } catch {
  }

  setMessage(`Playing ${payload.label}`);
  setStorageStatus(`Playing ${payload.label}`);
  await loadStatus();
}

async function stopStoragePreviewPlayback() {
  const audio = ensureStoragePreviewAudio();
  audio.pause();
  audio.currentTime = 0;
  await request("/api/stop", { method: "POST", body: JSON.stringify({}) });
  await loadStatus();
  setStorageStatus("Playback stopped");
}

async function openStoragePreview(entry) {
  if (!entry || entry.isDirectory || !isAudioStoragePath(entry.path)) {
    return;
  }

  state.storagePreviewRequestId += 1;
  const requestId = state.storagePreviewRequestId;
  state.storagePreviewItem = entry;
  releaseStoragePreviewUrls();
  resetStoragePreviewUi();

  if (elements.storagePreviewTitle) {
    elements.storagePreviewTitle.textContent = entry.name || "Track Preview";
  }
  if (elements.storagePreviewMeta) {
    elements.storagePreviewMeta.textContent = `${formatBytes(entry.sizeBytes || 0)} • ${storageBadgeLabel(entry)} • ${entry.path}`;
  }
  if (elements.storagePreviewAlbum) {
    elements.storagePreviewAlbum.textContent = "Reading metadata and album art...";
  }
  elements.storagePreviewModal?.showModal();

  const response = await fetch(storageStreamUrl(entry.path, state.activeStorageTarget), { cache: "no-store" });
  const blob = await response.blob();
  if (requestId !== state.storagePreviewRequestId) {
    return;
  }

  state.storagePreviewObjectUrl = URL.createObjectURL(blob);
  const audio = ensureStoragePreviewAudio();
  audio.pause();
  audio.currentTime = 0;
  audio.src = state.storagePreviewObjectUrl;
  audio.load();

  let albumSummary = `File: ${entry.name || entry.path}`;
  if (blob.type.includes("mpeg") || storageFileExtension(entry.path) === "mp3") {
    const metadata = parseId3Metadata(await blob.arrayBuffer());
    const title = metadata.title || entry.name || entry.path;
    const artist = metadata.artist || "Unknown artist";
    const album = metadata.album || "Unknown album";
    albumSummary = `${title}\n${artist}\n${album}`;

    if (metadata.artworkBytes?.length) {
      state.storagePreviewArtworkUrl = URL.createObjectURL(new Blob([metadata.artworkBytes], { type: metadata.artworkType || "image/jpeg" }));
      if (elements.storagePreviewArtwork) {
        elements.storagePreviewArtwork.src = state.storagePreviewArtworkUrl;
        elements.storagePreviewArtwork.hidden = false;
      }
      if (elements.storagePreviewArtworkFallback) {
        elements.storagePreviewArtworkFallback.hidden = true;
      }
    }

    if (elements.storagePreviewTitle) {
      elements.storagePreviewTitle.textContent = title;
    }
    if (elements.storagePreviewMeta) {
      elements.storagePreviewMeta.textContent = `${artist} • ${album} • ${formatBytes(entry.sizeBytes || blob.size || 0)}`;
    }
  }

  if (elements.storagePreviewAlbum) {
    elements.storagePreviewAlbum.textContent = albumSummary;
  }
}

function renderStorageManager(payload) {
  const target = resolveStorageTarget(String(payload?.target || state.activeStorageTarget || "flash"));
  const label = storageTargetLabel(target);
  const storage = payload?.storage || state.storageInfoByTarget[target] || {};
  const currentPath = normalizeStorageDirectoryPath(payload?.currentPath || state.currentStoragePathByTarget[target] || "/");
  const entries = Array.isArray(payload?.entries) ? payload.entries : (Array.isArray(payload?.files) ? payload.files : []);
  state.activeStorageTarget = target;
  state.storageInfoByTarget[target] = storage;
  state.currentStorageEntriesByTarget[target] = entries;
  state.currentStoragePathByTarget[target] = currentPath;

  if (elements.storageTitle) {
    elements.storageTitle.textContent = `${label} File Manager`;
  }
  if (elements.storageSdConfig) {
    elements.storageSdConfig.hidden = target !== "sd";
  }
  renderStorageBreadcrumbs(currentPath);

  if (elements.storageSummary) {
    elements.storageSummary.textContent = storage.mounted
      ? `${formatBytes(storage.usedBytes || 0)} used of ${formatBytes(storage.totalBytes || 0)} • ${formatBytes(storage.freeBytes || 0)} free • ${currentPath}`
      : (target === "sd"
        ? (state.settings?.sd?.enabled ? "SD card is not mounted." : "SD card support is disabled.")
        : "Flash filesystem is not mounted.");
  }
  if (elements.storageLimit) {
    elements.storageLimit.textContent = storage.mounted
      ? `Max upload: ${formatBytes(storage.maxUploadBytes || 0)}`
      : (target === "sd" && !state.settings?.sd?.enabled ? "Enable SD card storage to mount it" : "Uploads unavailable");
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
    elements.storageFileList.innerHTML = `<div class="storage-empty-note">This folder is empty.</div>`;
    return;
  }

  const visiblePaths = entries.map((entry) => entry.path).filter(Boolean);
  setStorageSelection(activeStorageSelection(target).filter((path) => visiblePaths.includes(path)), target);
  const selectedPaths = activeStorageSelection(target);
  elements.storageFileList.innerHTML = entries.map((entry) => renderStorageRow(entry, state.storageSelectionMode, selectedPaths)).join("");
  updateStorageToolbar(storage);
}

async function refreshStorageManager(target = state.activeStorageTarget, directoryPath = state.currentStoragePathByTarget[target] || "/") {
  const payload = await request(`/api/storage?target=${encodeURIComponent(target)}&dir=${encodeURIComponent(normalizeStorageDirectoryPath(directoryPath))}`);
  renderStorageManager(payload);
  return payload;
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
    await loadStatus();
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
      ? `${formatBytes(sdSystem.freeBytes || 0)} free • GPIO${sd.csPin}/${sd.sckPin}/${sd.mosiPin}/${sd.misoPin}`
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
  const sdEnabled = Boolean(state.settings?.sd?.enabled);
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
    updateResourceCard(
      elements.deviceSdValue,
      elements.deviceSdBar,
      elements.deviceSdMeta,
      formatBytes(sd.freeBytes || 0),
      sdUsedPercent,
      `${formatBytes(sd.usedBytes || 0)} used of ${formatBytes(sd.totalBytes || 0)}`
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
      "SD card support is disabled. Use External Storage tab to configure pins and enable it."
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

function fillForm(data) {
  state.settingsLoading = true;
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
  renderHardwareSummary(state.status || {});
  renderDeviceResources(state.status || {});
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
  payload.sd ||= {};

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
  payload.sd.enabled = Boolean(elements.sdEnabled?.checked ?? payload.sd.enabled ?? false);
  payload.sd.csPin = Number(elements.sdCsPin?.value || payload.sd.csPin || DEFAULT_SD_GPIO_PINS.cs);
  payload.sd.sckPin = Number(elements.sdSckPin?.value || payload.sd.sckPin || DEFAULT_SD_GPIO_PINS.sck);
  payload.sd.mosiPin = Number(elements.sdMosiPin?.value || payload.sd.mosiPin || DEFAULT_SD_GPIO_PINS.mosi);
  payload.sd.misoPin = Number(elements.sdMisoPin?.value || payload.sd.misoPin || DEFAULT_SD_GPIO_PINS.miso);
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
  state.status = status;
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
  elements.volumeValue.textContent = `${document.activeElement === elements.volumeSlider ? elements.volumeSlider.value : savedVolumePercent}%`;
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
  renderGpioOverview();

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

    if (resolvedTabName === "storage-external") {
      refreshExternalStorageTab().catch(handleError);
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
  fillForm(state.settings);
  setFirmwareAuthorLink(state.settings);
  renderGpioOverview();
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
  if (sdPinsConflictInternally(submittedSettings)) {
    state.settingsSaving = false;
    throw new Error("SD card CS, SCK, MOSI, and MISO must use four different GPIOs.");
  }
  if (sdPinsConflictWithReservedFunctions(submittedSettings)) {
    state.settingsSaving = false;
    throw new Error("SD card pins cannot reuse the active audio, battery, status LED, or Wape trigger GPIOs.");
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
    if (activeTabName() === "storage-external") {
      await refreshStorageManager(state.activeStorageTarget);
    }
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
elements.storageUpButton?.addEventListener("click", () => {
  const parentPath = storageParentPath(state.currentStoragePathByTarget[state.activeStorageTarget] || "/");
  if (parentPath) {
    openStorageManager(state.activeStorageTarget, parentPath).catch(handleError);
  }
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
elements.storageBreadcrumbs?.addEventListener("click", (event) => {
  const crumbButton = event.target.closest("[data-storage-nav]");
  if (!crumbButton) {
    return;
  }
  clearStorageSelection();
  openStorageManager(state.activeStorageTarget, crumbButton.dataset.storageNav).catch(handleError);
});
elements.storagePreviewPlayButton?.addEventListener("click", () => {
  playStoragePreviewOnDevice().catch(handleError);
});
elements.storagePreviewStopButton?.addEventListener("click", () => {
  stopStoragePreviewPlayback().catch(handleError);
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
elements.volumeSlider.addEventListener("input", (event) => {
  elements.volumeValue.textContent = `${event.target.value}%`;
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
