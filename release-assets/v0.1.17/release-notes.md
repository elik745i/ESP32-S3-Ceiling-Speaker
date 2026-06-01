ESP32 Notifier v0.1.17

- Added per-effect volume controls for startup, alarm, notification, ambient, low-battery, shut-down, update-available, and update-success cues in the web UI.
- Persisted each effect volume independently and restored those values across reboots.
- Prevented focused effect-volume inputs from being overwritten during live UI refreshes while typing.
- Routed effect previews and playback through the correct effect source so each selector controls its own event volume.
- Deferred MQTT connect and disconnect requests out of the web request path to avoid synchronous settings and reconnect work during the button press.
- Added a dedicated MQTT-tab rediscovery control to republish Home Assistant discovery without forcing a broker reconnect.
- Documented the requirement for unique MQTT client IDs, base topics, and device names when multiple devices share one broker.
- Added Home Assistant MQTT discovery entities for battery percentage and charging state alongside battery voltage.
- Switched charging detection to prefer the configured charging-sense GPIO and fall back to voltage-trend detection only when no sense pin is configured.
- Updated the web battery card to show charging state instead of relying only on high-voltage USB-power detection.
- Stopped generic MQTT broker reachability failures from triggering a forced recovery reboot; the device now keeps retrying and reports the error instead.
- Avoided live SD summary probes during active SD playback so ambient and other SD-backed audio are less likely to be interrupted by status polling.
- Raised the preferred SD SPI mount speed to 40 MHz with automatic fallbacks through slower clocks for cards or wiring that need more margin.
- Fixed SD folder navigation during playback-safe cached views so opening a folder no longer leaves the previous directory rendered on screen.
- Restored SD infinite scrolling during playback for indexed folders, so large directories continue loading past the first 20 entries.
- Changed SD reindex actions to stop playback first and then continue automatically instead of only reporting a blocker message.
- Fixed MQTT auto-connect after reboot so the firmware now uses the same configure-and-connect path as the manual Connect button.

Release assets:

- esp32-notifier-v0.1.17.bin
- esp32-notifier-hacs-v0.1.17.bin
- esp32-notifier-hacs-slim-v0.1.17.bin
- esp32s3-notifier-v0.1.17.bin
- esp32s3-notifier-hacs-v0.1.17.bin
- esp32s3-notifier-hacs-slim-v0.1.17.bin
