ELMA IoT v0.1.40

- ELMA Flasher now enforces one running instance per Windows user. Starting it again restores and activates the existing startup or Designer window.
- The portable download remains one self-contained EXE with no separately installed tools.
- On first launch, an ELMA-styled startup window appears immediately and shows smooth, byte-accurate extraction progress for the embedded compiler, Qt Designer runtime and ESP support files.
- Extraction reserves its final progress stages for runtime validation and atomic cache activation; the Device Designer starts only after the progress bar reaches 100%.
- The verified heavy runtime is cached under a versioned per-user application-data directory, so subsequent launches avoid unpacking the full portable bundle again.
- Designer configuration and locally generated firmware binaries remain beside the launcher EXE, not in the disposable runtime cache.
- Retains the v0.1.39 PC provisioning Designer, real Windows Wi-Fi/MQTT checks, build memory estimates, optimized ESP32-C3 Super Mini SVG, async configuration recovery and standard generated binary naming.

Release assets:

- esp32-notifier-v0.1.40.bin
- esp32-notifier-hacs-v0.1.40.bin
- esp32-notifier-hacs-slim-v0.1.40.bin
- esp32s3-notifier-v0.1.40.bin
- esp32s3-notifier-hacs-v0.1.40.bin
- esp32s3-notifier-hacs-slim-v0.1.40.bin
- esp32c3-notifier-hacs-v0.1.40.bin
- ELMA-Flasher-v0.1.40.exe
