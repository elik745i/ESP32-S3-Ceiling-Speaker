ESP32 Notifier v0.1.21

- Fixed remembered last-played behavior so saved stream and media selections now preserve whether playback was stopped or active before reboot instead of always auto-resuming.
- Fixed sound-effect preview routing so effect dropdown changes use a deterministic stop-preview-resume flow and can restore interrupted playback after one-shot preview sounds.
- Fixed live SD-to-SD playback handoff by adding a short settle delay plus an SD remount retry path when switching directly between SD-backed files.
- Improved startup effect playback by deferring boot-time startup cues until the device has stabilized and retrying SD-backed startup sounds across transient mount failures.
- Reduced normal-boot serial noise by suppressing harmless OTA rollback `Preferences` `NOT_FOUND` messages when rollback-tracking keys are absent from NVS.

Release assets:

- esp32-notifier-v0.1.21.bin
- esp32-notifier-hacs-v0.1.21.bin
- esp32-notifier-hacs-slim-v0.1.21.bin
- esp32s3-notifier-v0.1.21.bin
- esp32s3-notifier-hacs-v0.1.21.bin
- esp32s3-notifier-hacs-slim-v0.1.21.bin