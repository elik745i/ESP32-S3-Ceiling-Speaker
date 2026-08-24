ESP32 Notifier v0.1.28

- Serialized firmware release refresh and selected-version installation so their TLS and HTTP operations cannot overlap.
- Fixed selected OTA installation after refreshing the release list.
- Reduced idle ESP32-S3 CPU load and temperature while keeping Wi-Fi and MQTT responsive.
- Fixed the vendored MQTT Media Player integration so an audio-disabled device's retained discovery tombstone removes its stale Unknown media-player entry instead of leaving an empty Home Assistant device card.
- Added immediately visible, configurable PCM5102 and other I2S audio-output GPIO bindings, with matching live canvas wiring and correct pin reservation behavior.
- Added TTP223 GPIO selection and live canvas wiring, plus ADC-only battery-divider GPIO choices that follow the selected board and update the diagram immediately.
- Assigned 10-second touch-hold factory reset to the first configured touch input and marked that input with an explanatory badge and tooltip.
- Kept the Configuration tab active while adding audio or display hardware and fixed I2C OLED SDA/SCL/RESET selectors appearing immediately after selection.
- Added clear dimmed selection feedback when choosing a microcontroller pin label for editing or removal.
- Built and USB-flashed the ESP32-S3 HACS image on the original speaker hardware, then confirmed v0.1.28 online with saved Wi-Fi settings intact.

Release assets:

- esp32-notifier-v0.1.28.bin
- esp32-notifier-hacs-v0.1.28.bin
- esp32-notifier-hacs-slim-v0.1.28.bin
- esp32s3-notifier-v0.1.28.bin
- esp32s3-notifier-hacs-v0.1.28.bin
- esp32s3-notifier-hacs-slim-v0.1.28.bin
