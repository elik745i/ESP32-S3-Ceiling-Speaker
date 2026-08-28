ELMA IoT v0.1.31

- Successful GitHub-release OTA installations now display the existing reboot countdown overlay instead of silently polling in the background.
- Successful resumable local firmware uploads use the same countdown and reconnect flow.
- The overlay waits for the current firmware to disconnect, detects the restarted device, clears browser caches, and performs a cache-busting hard refresh so the new firmware's UI, status, and assets are loaded.
- The longer GitHub OTA reboot grace period is preserved so the old firmware response cannot be mistaken for a completed restart.

Release assets:

- esp32-notifier-v0.1.31.bin
- esp32-notifier-hacs-v0.1.31.bin
- esp32-notifier-hacs-slim-v0.1.31.bin
- esp32s3-notifier-v0.1.31.bin
- esp32s3-notifier-hacs-v0.1.31.bin
- esp32s3-notifier-hacs-slim-v0.1.31.bin
- esp32c3-notifier-hacs-v0.1.31.bin
- ELMA-Flasher-v0.1.31.exe
