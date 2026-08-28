ESP32 Notifier v0.1.29

- Added browser-based USB flashing from the Firmware tab using Espressif's Web Serial flasher implementation.
- Added Clone Current Device and Flash From File modes with an explicit erase-before-flashing choice.
- Clone mode copies firmware, configuration, Wi-Fi, MQTT credentials, GPIO/peripheral settings, and UI preferences without copying the source chip identity.
- Regenerates the cloned target's device name, friendly name, MQTT client ID, and MQTT base topic from the target's own hardware ID to prevent broker and Home Assistant collisions.
- Reports detailed USB selection, bootloader sync, chip-family mismatch, download, erase, write, verification, reset, provisioning, and Wi-Fi connection failures.
- Displays circular flashing progress aligned with the existing ELMA IoT interface and offers the target device IP after cloned Wi-Fi connects.
- Added a loopback-only localhost launcher for Chrome/Edge so Web Serial can show the COM-port chooser even though an ESP device's own HTTP page is not a secure browser origin.
- Added ELMA Flasher, a styled single-file Windows application with its Python runtime, Espressif flashing engine, serial support, and ESP32/ESP32-S3 boot images embedded. It provides native COM selection, Clone Current Device, Flash From File, optional erase, progress/error reporting, hardware-ID-safe configuration cloning, and cloned-device IP handoff without requiring browser Web Serial or separately installed utilities.
- Fixed the ELMA Flasher layout so the Flash USB Device button remains pinned and visible at the bottom under Windows display scaling.
- Applied the approved ELMA IoT project logo to the executable, application window, Alt+Tab switcher, and Windows taskbar instead of the default Python/Tk icon.
- Added automatic USB target detection plus a manual ESP32/ESP32-S3 override. Incompatible chip choices are disabled for the selected firmware, and the flasher blocks erase/write when the connected chip and firmware family differ.
- Corrected chip reporting so ESP32-C3/C6/S2 and other recognized models are not collapsed into generic ESP32; unsupported targets and detected flash capacity are now shown explicitly.
- Added optional target preconfiguration, disabled by default, for a friendly device name, Wi-Fi credentials, an explicitly unique static IP, MQTT broker credentials/discovery, fallback AP credentials, and web authentication. Blank fields retain device/clone defaults; static source IPs and hardware-derived device/MQTT identities are never cloned.
- Moved clone-image endpoints outside the generic firmware route so manifest and partition requests cannot be swallowed by the firmware status handler.
- Raised station Wi-Fi transmit power from 8.5 dBm to a conservative 15 dBm ceiling for more reliable mesh and OTA links without using the radio's 20 dBm maximum.
- Fixed local-upload rollback reporting so a successfully booted v0.1.29 image is not falsely reported as having rolled back because its upload label differed from its semantic version.
- Replaced the single fragile browser upload request with resumable, idempotent 16 KiB chunks. Weak Wi-Fi interruptions now reconcile the device's committed byte offset and retry indefinitely, while the upload button becomes Cancel Upload Local Firmware and safely aborts the pending OTA image on request.

Release assets:

- esp32-notifier-v0.1.29.bin
- esp32-notifier-hacs-v0.1.29.bin
- esp32-notifier-hacs-slim-v0.1.29.bin
- esp32s3-notifier-v0.1.29.bin
- esp32s3-notifier-hacs-v0.1.29.bin
- esp32s3-notifier-hacs-slim-v0.1.29.bin
- ELMA-Flasher-v0.1.29.exe
