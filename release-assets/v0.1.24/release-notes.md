ESP32 Notifier v0.1.24

- Reduced baseline ESP32-S3 radio power usage by switching Wi-Fi modes dynamically instead of keeping AP+STA active full time.
- Enabled Wi-Fi modem sleep in station-only mode and lowered station transmit power to reduce idle heat and unnecessary radio power draw.
- Relaxed the main input polling cadence so the firmware wakes the CPU less aggressively during normal idle operation.
- Added runtime CPU frequency scaling so idle operation can run at a lower clock while playback, OTA, and AP fallback still keep full performance.
- Fixed OTA state synchronization so the app no longer leaves the public status stuck in a busy update state after checks and uploads finish.
- Improved thermal troubleshooting on the ESP32-S3 ceiling-speaker build by making post-boot idle behavior match the real runtime state more closely.

Release assets:

- esp32-notifier-v0.1.24.bin
- esp32-notifier-hacs-v0.1.24.bin
- esp32-notifier-hacs-slim-v0.1.24.bin
- esp32s3-notifier-v0.1.24.bin
- esp32s3-notifier-hacs-v0.1.24.bin
- esp32s3-notifier-hacs-slim-v0.1.24.bin
