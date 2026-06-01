ESP32 Notifier v0.1.15

- Added low-battery sleep controls with configurable threshold and wake interval handling for supported battery-powered builds.
- Added optional battery charging-sense pin support and surfaced that configuration in the web UI.
- Added selectable display modes so the device can run either the OLED renderer or Wape trigger mode.
- Added Wape trigger pin and trigger-event settings for device start, playback start, and charging start flows.
- Added configurable local sound-effect routing for startup, notification, alarm, ambient, low-battery, shutdown, update-available, and update-success events.
- Expanded the web UI with an Audio Effects workflow, hardware monitor cards, richer GPIO guidance, and improved storage management controls.
- Added a compact header gear menu with refresh, reboot, and shutdown actions.
- Added a reboot countdown overlay that waits for the device to reconnect before hard-refreshing the page.
- Hardened the reboot overlay startup logic so it only appears for explicit reboot actions and stays hidden on normal page loads.
- Hardened the storage toolbar UI so icon-only button layouts do not throw startup errors.
- Updated OTA defaults and release browsing to use the primary GitHub repository asset flow consistently.

Release assets:

- esp32-notifier-v0.1.15.bin
- esp32-notifier-hacs-v0.1.15.bin
- esp32-notifier-hacs-slim-v0.1.15.bin
- esp32s3-notifier-v0.1.15.bin
- esp32s3-notifier-hacs-v0.1.15.bin
- esp32s3-notifier-hacs-slim-v0.1.15.bin
