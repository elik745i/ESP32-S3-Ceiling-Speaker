ESP32 Notifier v0.1.18

- Followed up the OTA startup flow so auto-update always implies a boot-time release check, including on units carrying older saved preferences.
- Added Home Assistant MQTT discovery controls for firmware auto-update and device reboot so those actions can be surfaced directly from the MQTT integration.
- Clarified that low-battery deep sleep is off by default, and documented that an incorrect measured battery voltage can still make a unit unreachable if deep sleep is manually enabled before calibration is corrected.
- Preserved the `0.1.17` SD browsing, SD reindex, MQTT auto-connect, and faster SD clock fixes while moving the release line forward for OTA testing.
- Published a dedicated `0.1.18` release so devices flashed with the fixed `0.1.17` firmware can verify automatic upgrade behavior on reboot.

Release assets:

- esp32-notifier-v0.1.18.bin
- esp32-notifier-hacs-v0.1.18.bin
- esp32-notifier-hacs-slim-v0.1.18.bin
- esp32s3-notifier-v0.1.18.bin
- esp32s3-notifier-hacs-v0.1.18.bin
- esp32s3-notifier-hacs-slim-v0.1.18.bin