ELMA IoT v0.1.35

- Added a saved status LED type selector for regular LEDs and RGB NeoPixel / WS2812 indicators.
- ESP32-C3 Designer firmware now defaults its onboard GPIO8 status indicator to NeoPixel mode.
- Link indication remains steady when connected, blinks in AP mode, and flashes while disconnected.
- Fixed USB provisioning of larger designer profiles by waiting for the target receive acknowledgement and transferring configuration in paced chunks.
- Retains native Device Designer compilation, USB flashing, peripheral wiring, Wi-Fi/MQTT provisioning, hardware-derived identity, and maximum-fit chip profiles.

Release assets:

- esp32-notifier-v0.1.35.bin
- esp32-notifier-hacs-v0.1.35.bin
- esp32-notifier-hacs-slim-v0.1.35.bin
- esp32s3-notifier-v0.1.35.bin
- esp32s3-notifier-hacs-v0.1.35.bin
- esp32s3-notifier-hacs-slim-v0.1.35.bin
- esp32c3-notifier-hacs-v0.1.35.bin
- ELMA-Flasher-v0.1.35.exe
