# ELMA IoT v0.1.41

## Firmware and OTA

- Add STA/AP transmit-power bars in the EXE and Full device Wi-Fi page, with persisted settings, compiled defaults and driver-reported active power. Requested range is 2–19.5 dBm; hardware may round/cap it. AP+STA shares the higher requested limit. Generic Full builds retain 15 dBm; existing saved device values override OTA defaults. Minimal recovery retains its maximum-power request without changing saved settings.
- Prevent recovery reboots from interrupting active OTA writes.
- Add 8 KiB PC-upload retries/resumption and compatibility with the legacy ELMA v0.1.27 multipart endpoint.
- Add Minimal Wi-Fi + OTA recovery images for ESP32, ESP32-S3 and ESP32-C3. These preserve saved ELMA NVS configuration and the existing partition table when installed over OTA, disable Wi-Fi sleep and remove the old STA transmit-power ceiling.
- Minimal firmware is a temporary recovery bridge: peripheral functions are unavailable until a matching Full image is installed. Use a trusted LAN and back up configuration first. No live-device flashing is performed as part of this release build.
- Include motor/control assignment, MQTT state reporting, UI edit responsiveness, boot/recovery and GitHub release-check fixes accumulated since v0.1.40.

## ELMA Flasher

- Place Flash connection and Target chip first, with Full/Minimal firmware selection below; Compile and Save uses the same selection.
- Reuse unchanged, hash-verified firmware on IP upload retry instead of recompiling.
- Add LAN discovery, chip verification, foreign-firmware confirmation and safe cancellation controls.
- Add Tasmota/ESPHome configuration migration with reviewable GPIO/peripheral mapping; ESPHome GPIO import requires source YAML.
- Include native configuration Open/Save/Save As, manual board selection/autodetect controls and selected-board-only firmware assets.

## Release assets

- esp32-notifier-v0.1.41.bin
- esp32-notifier-hacs-v0.1.41.bin
- esp32-notifier-hacs-slim-v0.1.41.bin
- esp32s3-notifier-v0.1.41.bin
- esp32s3-notifier-hacs-v0.1.41.bin
- esp32s3-notifier-hacs-slim-v0.1.41.bin
- esp32c3-notifier-hacs-v0.1.41.bin
- esp32-ota-bridge-v0.1.41.bin
- esp32s3-ota-bridge-v0.1.41.bin
- esp32c3-ota-bridge-v0.1.41.bin
- ELMA-Flasher-v0.1.41.exe
- SHA256SUMS.txt

Full images use ESP32-WROOM, ESP32-S3 Super Mini and ESP32-C3 board defaults. Build with the EXE for another supported board. Firmware `.bin` files are application-only OTA images, not merged full-flash images. All images are checked for chip family, version and OTA-slot size. Automated tests do not replace live-device verification.

## Release verification

- All 10 firmware builds passed chip-family, v0.1.41 and OTA-partition-size checks.
- 15 offline JavaScript/Python Wi-Fi-power and interrupted-OTA regression tests passed, plus the native C++ radio-power policy assertions.
- The packaged EXE passed startup and native Designer smoke tests, including Wi-Fi sliders and existing board, motor, migration and flash controls.
- The packaged compiler built ESP32, ESP32-S3 and ESP32-C3 images with custom STA/AP power defaults and verified selected-board-only illustrations.
- `SHA256SUMS.txt` covers all ten firmware images and the EXE.
