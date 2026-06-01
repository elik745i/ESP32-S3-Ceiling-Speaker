ESP32 Notifier v0.1.19-beta

- Added Device-tab configuration backup and restore actions that export a readable Markdown file with embedded JSON and restore the same settings onto a freshly flashed device.
- Expanded backup coverage so saved Wi-Fi and MQTT credentials, sound-effect routing, GPIO and peripheral assignments, board-selection preferences, and peripheral-diagram positions and rotations round-trip through the saved settings model.
- Moved peripheral-diagram layout persistence out of browser-only storage and into device Preferences so node positions and rotations survive reboot and reload from `/api/settings`.
- Moved Factory Reset into the Device tab and made the reset flow bypass pre-restart autosave so a wipe does not accidentally persist pending edits immediately before erasing settings.
- Kept the existing OTA release workflow and asset matrix unchanged so this beta can be published with the standard six firmware artifacts as a GitHub prerelease.

Release assets:

- esp32-notifier-v0.1.19-beta.bin
- esp32-notifier-hacs-v0.1.19-beta.bin
- esp32-notifier-hacs-slim-v0.1.19-beta.bin
- esp32s3-notifier-v0.1.19-beta.bin
- esp32s3-notifier-hacs-v0.1.19-beta.bin
- esp32s3-notifier-hacs-slim-v0.1.19-beta.bin