ESP32 Notifier v0.1.17

- Added per-effect volume controls for startup, alarm, notification, ambient, low-battery, shut-down, update-available, and update-success cues in the web UI.
- Persisted each effect volume independently and restored those values across reboots.
- Prevented focused effect-volume inputs from being overwritten during live UI refreshes while typing.
- Routed effect previews and playback through the correct effect source so each selector controls its own event volume.
- Deferred MQTT connect and disconnect requests out of the web request path to avoid synchronous settings and reconnect work during the button press.
- Documented the requirement for unique MQTT client IDs, base topics, and device names when multiple devices share one broker.

Release assets:

- esp32-notifier-v0.1.17.bin
- esp32-notifier-hacs-v0.1.17.bin
- esp32-notifier-hacs-slim-v0.1.17.bin
- esp32s3-notifier-v0.1.17.bin
- esp32s3-notifier-hacs-v0.1.17.bin
- esp32s3-notifier-hacs-slim-v0.1.17.bin
