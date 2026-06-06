ESP32 Notifier v0.1.20

- Promoted the `0.1.20-beta` line to a stable release after the ceiling-speaker UI and firmware fixes landed together.
- Expanded the dynamic peripheral diagram with persistent custom label wiring, right-click wire deletion, default-wire suppression, hover bend-point editing, and extracted global undo and redo support for web UI changes.
- Added remembered last-played media and stream state so playback selection can survive page refreshes and device reboot, with a user-facing `Remember last played` toggle in the Audio tab.
- Added a live online and offline state indicator to the header gear button and stopped repeated web console noise when the device is unreachable, so offline polling now fails quietly instead of flooding fetch errors.
- Preserved the six standard OTA asset names for the stable `v0.1.20` release so GitHub Releases and in-device firmware matching continue to resolve the expected non-beta binaries.

Release assets:

- esp32-notifier-v0.1.20.bin
- esp32-notifier-hacs-v0.1.20.bin
- esp32-notifier-hacs-slim-v0.1.20.bin
- esp32s3-notifier-v0.1.20.bin
- esp32s3-notifier-hacs-v0.1.20.bin
- esp32s3-notifier-hacs-slim-v0.1.20.bin
