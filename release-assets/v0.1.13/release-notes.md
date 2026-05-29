ESP32 Notifier v0.1.13

- Fixed 4MB release compatibility by moving the full-web ESP32 and ESP32-S3 builds onto a larger 4MB-safe application layout, including the ESP32-S3 image-header correction for common Super Mini boards
- Added a richer GPIO Info experience with dedicated board SVGs, board recommendations, and side-by-side pin guidance for multiple ESP32 families
- Added live firmware metadata in the web header, including the running version badge, release-channel text, and author link
- Expanded the web UI around storage and playback with internal or SD storage management, recent playback history, and richer radio transport controls
- Set the browser radio defaults to Azerbaijan and AvtoFM and refreshed the README to reflect the current hardware, flash, UI, and release behavior

Release assets:

- esp32-notifier-v0.1.13.bin
- esp32-notifier-hacs-v0.1.13.bin
- esp32-notifier-hacs-slim-v0.1.13.bin
- esp32s3-notifier-v0.1.13.bin
- esp32s3-notifier-hacs-v0.1.13.bin
- esp32s3-notifier-hacs-slim-v0.1.13.bin