ELMA IoT v0.1.30

- Added ELMA Device Designer to the portable Windows flasher. It clones the device web configurator locally, including graphical GPIO/peripheral wiring, and adds chip, feature, COM-port, compile, flash, progress, log, and cancellation controls.
- Added an ESP32-C3 maximum-fit target. It retains the compatible web configurator, Wi-Fi, MQTT/Home Assistant, OTA, motor/GPIO, display, sensor, input, control, expansion, storage, and communication functionality while excluding the network-audio engine.
- ESP32-S3 maximum mode continues to include the complete currently supported multimedia and peripheral set.
- Added capability-aware selected-feature profiles for optional on-device web UI, HACS/MQTT, and audio inclusion.
- The builder detects chip family and flash capacity before erase, blocks mismatches, verifies the generated image and OTA-slot fit, and provisions the complete saved configuration after flashing.
- Device name, MQTT client ID, and MQTT base topic remain derived from the target chip hardware ID. Wi-Fi and MQTT credentials, AP configuration, friendly identity, GPIO mapping, and peripheral configuration are provisioned separately after flashing.
- The portable EXE includes its compiler command core. PlatformIO downloads and caches the required Espressif compiler/framework packages automatically on first use, so users do not install development utilities manually.

Release assets:

- esp32-notifier-v0.1.30.bin
- esp32-notifier-hacs-v0.1.30.bin
- esp32-notifier-hacs-slim-v0.1.30.bin
- esp32s3-notifier-v0.1.30.bin
- esp32s3-notifier-hacs-v0.1.30.bin
- esp32s3-notifier-hacs-slim-v0.1.30.bin
- esp32c3-notifier-hacs-v0.1.30.bin
- ELMA-Flasher-v0.1.30.exe
