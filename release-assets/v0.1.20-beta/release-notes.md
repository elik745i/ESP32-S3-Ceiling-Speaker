ESP32 Notifier v0.1.20-beta

- Fixed peripheral-diagram label persistence and editor behavior so zooming, reopening the editor, adding labels, removing default labels, rewiring, and resetting wiring no longer scramble saved layouts.
- Restored the recent audio and effects regressions by fixing the settings persistence path used for I2S output state and effect volume updates.
- Reduced bundled web asset size by optimizing the generated SVG pipeline without changing the firmware asset naming scheme or OTA release matrix.
- Removed repeated `/api/settings` heap churn by returning the persisted UI JSON blobs directly instead of reparsing them server-side on every request, which should improve long-running web UI stability on ESP32-S3 devices.
- Kept the standard six-bin GitHub prerelease layout unchanged so OTA discovery still resolves the expected beta asset names.

Release assets:

- esp32-notifier-v0.1.20-beta.bin
- esp32-notifier-hacs-v0.1.20-beta.bin
- esp32-notifier-hacs-slim-v0.1.20-beta.bin
- esp32s3-notifier-v0.1.20-beta.bin
- esp32s3-notifier-hacs-v0.1.20-beta.bin
- esp32s3-notifier-hacs-slim-v0.1.20-beta.bin
