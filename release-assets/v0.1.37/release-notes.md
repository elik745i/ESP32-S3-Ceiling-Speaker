ELMA IoT v0.1.37

- Fixed configured DRV8833 inputs floating during ESP startup by applying saved motor pin settings before the USB serial grace period and all network/service initialization.
- Controlled restarts now stop every motor channel and hold its configured outputs LOW across the ESP reset.
- Motor direction changes insert an all-inputs-off dead time before activating the requested direction.
- Motor commands verify the active GPIO level and report an actionable wiring or short-circuit error if the output cannot go HIGH.

Release assets:

- esp32-notifier-v0.1.37.bin
- esp32-notifier-hacs-v0.1.37.bin
- esp32-notifier-hacs-slim-v0.1.37.bin
- esp32s3-notifier-v0.1.37.bin
- esp32s3-notifier-hacs-v0.1.37.bin
- esp32s3-notifier-hacs-slim-v0.1.37.bin
- esp32c3-notifier-hacs-v0.1.37.bin
- ELMA-Flasher-v0.1.37.exe
