ELMA IoT v0.1.34

- Fixed Device Designer firmware compilation failing before PlatformIO could produce `firmware.bin`.
- Portable firmware builds no longer attempt to validate repository-only flasher, README, and release-note files that are intentionally absent from the extracted reduced builder workspace.
- Fixed PyInstaller helper-process validation in the embedded PlatformIO compiler, including bootloader and partition generation.
- Compiler failures now return a real failure status instead of falling through to a misleading missing-`firmware.bin` error.
- Release validation now performs a complete ESP32-C3 firmware compilation from the finished portable ELMA Flasher executable.
- Normal source builds and GitHub CI retain complete firmware, flasher, README, release-note, and release-tag synchronization validation.
- The bundled native Device Designer, chip detection, maximum-fit profiles, peripheral configuration, compilation, USB flashing, progress, cancellation, and provisioning remain available without a browser or external utilities.

Release assets:

- esp32-notifier-v0.1.34.bin
- esp32-notifier-hacs-v0.1.34.bin
- esp32-notifier-hacs-slim-v0.1.34.bin
- esp32s3-notifier-v0.1.34.bin
- esp32s3-notifier-hacs-v0.1.34.bin
- esp32s3-notifier-hacs-slim-v0.1.34.bin
- esp32c3-notifier-hacs-v0.1.34.bin
- ELMA-Flasher-v0.1.34.exe
