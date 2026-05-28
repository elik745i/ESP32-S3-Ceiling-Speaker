ESP32 Notifier v0.1.11

- Added Home Assistant OTA firmware selection, selected-install flow, live progress reporting, and clearer OTA phase/status messages
- Enabled bootloader OTA rollback with rollback state and reason reporting over MQTT and Home Assistant
- Fixed shared ESP32-S3 OTA asset selection and added the missing `esp32s3_notifier_hacs_slim` release profile
- ESP32-S3 builds now use S3-specific default Device Name and Friendly Name patterns and append the hardware ID suffix automatically
- README and release asset documentation updated for the full ESP32 and ESP32-S3 matrix

Release assets:

- esp32-notifier-v0.1.11.bin
- esp32-notifier-hacs-v0.1.11.bin
- esp32-notifier-hacs-slim-v0.1.11.bin
- esp32s3-notifier-v0.1.11.bin
- esp32s3-notifier-hacs-v0.1.11.bin
- esp32s3-notifier-hacs-slim-v0.1.11.bin