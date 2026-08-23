ESP32 Notifier v0.1.25

- Improved runtime CPU frequency scaling with three performance levels: 80 MHz while idle, 160 MHz during stable audio playback, and 240 MHz for audio buffering, OTA updates, and access-point mode.
- Added immediate performance upshifts plus delayed downshifts so audio and OTA work gain headroom without rapid clock changes during short state transitions.
- Fixed system metrics so the web UI and MQTT state report the current runtime CPU frequency instead of the boot-time frequency.
- Replaced the drifting idle-loop CPU-load estimate with per-core FreeRTOS scheduler-tick sampling, preventing steady workloads from gradually falling to a false 0% reading.
- Kept the scheduler-tick callbacks and their complete application-side sampling path in IRAM so NVS and OTA flash operations cannot invoke cached firmware code while the SPI flash cache is disabled.
- Added a dedicated CPU Clock card plus aggregate and per-core CPU load details to the Hardware Monitor.
- Removed the redundant embedded ICO favicon while retaining the optimized SVG logo, recovering substantial OTA flash headroom without changing visible artwork.
- Audited embedded illustrations and retained multipass SVGO plus maximum gzip compression for every built-in SVG; added a build-time compressed-asset size report to catch future flash regressions.
- Fixed migration of the legacy `ESP32-S3-Ceiling-Speaker` OTA repository setting to `elma-iot/ELMA-IoT`, including devices that already saved the new owner with the old repository name.
- Retained the v0.1.24 Wi-Fi station-only mode, modem sleep, and reduced station transmit-power optimizations.

Hardware validation:

- Recovered and reflashed the ESP32-S3 ceiling-speaker over native USB without erasing NVS.
- Confirmed v0.1.25 boot, Wi-Fi and MQTT reconnection, SD-backed ambient playback, 160 MHz playback clock, 35-37% aggregate load with per-core readings, 47-48 C operating temperature during the validation window, and a cleared rollback state.

Release assets:

- esp32-notifier-v0.1.25.bin
- esp32-notifier-hacs-v0.1.25.bin
- esp32-notifier-hacs-slim-v0.1.25.bin
- esp32s3-notifier-v0.1.25.bin
- esp32s3-notifier-hacs-v0.1.25.bin
- esp32s3-notifier-hacs-slim-v0.1.25.bin

SHA-256 checksums:

- `esp32-notifier-v0.1.25.bin`: `A1EDE1B73FB8A6CFECC7A4A1C02E7E1CB7EA7C38634C5D7A2648350EBAEA6911`
- `esp32-notifier-hacs-v0.1.25.bin`: `5F77BD942960EA61073DE9CD3A121D5C8FFB3C8B1C156405B37DA3AFB8CC0C6B`
- `esp32-notifier-hacs-slim-v0.1.25.bin`: `1D4A66D236E80234C4554F29DBDDFA5AD1739B497B534B94E964294AF7194599`
- `esp32s3-notifier-v0.1.25.bin`: `0E9D177540C439D34EFFC8452FB09327300598A68A633213413A838B9917CE34`
- `esp32s3-notifier-hacs-v0.1.25.bin`: `92B569A8F634B1F3DC5B24FD34CF1674E10F3D5FAA9FB9F2647DB77E71821889`
- `esp32s3-notifier-hacs-slim-v0.1.25.bin`: `F3F5F4FC22E94A66AD7C60F620F9B5E83FC7510F8D42669AC3A933E558558332`
