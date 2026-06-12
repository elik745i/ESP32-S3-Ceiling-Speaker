ESP32 Notifier v0.1.23

- Fixed OTA update hangs caused by stalled firmware downloads that could leave the device stuck indefinitely at an arbitrary flashing percentage.
- Added OTA stall detection that treats 15 seconds without new download data as a broken transfer instead of waiting forever.
- Added bounded OTA resume retries that reopen the firmware download from the last written byte offset when the release host supports HTTP range requests.
- Added OTA recovery reboot handling so repeated stalled-download failures restart the device back into the current firmware instead of leaving it stranded in a busy update state.
- Improved OTA failure handling when the firmware host does not support resumed downloads by aborting cleanly and rebooting the device back into an operational state.
- Fixed web asset bundling to use a cross-platform `npx` launcher so GitHub Actions verification and release builds work on Linux runners as well as Windows development machines.

Release assets:

- esp32-notifier-v0.1.23.bin
- esp32-notifier-hacs-v0.1.23.bin
- esp32-notifier-hacs-slim-v0.1.23.bin
- esp32s3-notifier-v0.1.23.bin
- esp32s3-notifier-hacs-v0.1.23.bin
- esp32s3-notifier-hacs-slim-v0.1.23.bin
