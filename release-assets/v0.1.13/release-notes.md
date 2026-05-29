ESP32 Notifier v0.1.13

- Restored true 4MB OTA redundancy by moving the full-web ESP32 and ESP32-S3 builds back to dual OTA slots and removing the internal flash filesystem partition from the 4MB release layout
- Added runtime guards so firmware update flows refuse unsupported single-slot targets instead of crashing during flash writes
- Moved SD file browsing into the dedicated External Storage tab and removed the old Hardware-tab SD launcher flow
- Added a richer GPIO Info experience with dedicated board SVGs, board recommendations, and side-by-side pin guidance for multiple ESP32 families
- Added live firmware metadata in the web header, including the running version badge, release-channel text, and author link
- Expanded the web UI around storage and playback with SD storage management, recent playback history, and richer radio transport controls
- Set the browser radio defaults to Azerbaijan and AvtoFM and refreshed the README to reflect the current hardware, flash, UI, and release behavior

Important 4MB layout note:

- 4MB full-web release builds now prioritize dual OTA rollback safety over internal flash storage, so `Flash FS` is unavailable on that layout and the dedicated External Storage tab manages SD content instead

Release assets:

- esp32-notifier-v0.1.13.bin
- esp32-notifier-hacs-v0.1.13.bin
- esp32-notifier-hacs-slim-v0.1.13.bin
- esp32s3-notifier-v0.1.13.bin
- esp32s3-notifier-hacs-v0.1.13.bin
- esp32s3-notifier-hacs-slim-v0.1.13.bin