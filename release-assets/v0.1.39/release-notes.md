ELMA IoT v0.1.39

- ELMA Flasher is now a PC provisioning application instead of a simulated running-device dashboard.
- The separate native Flash USB Device tab was removed. Target detection, feature policy, compile, erase, flash, verification, cancellation and provisioning now live in the Firmware page.
- Device power/restart controls, internal/external storage and runtime media/motor panels are hidden in PC Designer mode while their real-device web equivalents remain unchanged.
- The PC Hardware page reports build-time flash and static-RAM estimates, then replaces them with confirmed binary and linker values after compilation.
- Wi-Fi Scan Networks uses the Windows Wi-Fi adapter. Connect validates the selected SSID and password through Windows and stores verified credentials for later firmware builds; PCs without Wi-Fi receive a direct adapter-unavailable message.
- MQTT Connect performs a real MQTT 3.1.1 broker authentication test from the PC and reports MQTT Connected only after a successful CONNACK.
- Designer configuration is asynchronously autosaved as `ELMA-Flasher.config.json` beside the portable EXE so edits survive application crashes and automatically reload; absent files cleanly fall back to defaults.
- Every locally compiled application binary is retained beside the EXE under the standard project release-asset name.
- The ESP32-C3 Super Mini now uses the supplied optimized breadboard SVG with the physical top-to-bottom pin order preserved on both sides.
- The Info page now documents ELMA Flasher, supported chips, identity safety, capabilities and the ELMA IoT GitHub project.
- Includes the v0.1.37 DRV8833 startup/restart safety fix and v0.1.38 whole-interface responsive scaling.

Release assets:

- esp32-notifier-v0.1.39.bin
- esp32-notifier-hacs-v0.1.39.bin
- esp32-notifier-hacs-slim-v0.1.39.bin
- esp32s3-notifier-v0.1.39.bin
- esp32s3-notifier-hacs-v0.1.39.bin
- esp32s3-notifier-hacs-slim-v0.1.39.bin
- esp32c3-notifier-hacs-v0.1.39.bin
- ELMA-Flasher-v0.1.39.exe
