ESP32 Notifier v0.1.16

- Fixed SD storage preview playback so device-side play starts immediately instead of stalling behind artwork scans or folder artwork lookups.
- Added a single-selection storage toolbar play action and kept modal playback pinned to the correct storage target.
- Fixed the external storage breadcrumb path so folder names stay inline and contiguous in the SD file manager.
- Fixed Audio Effects ambient behavior so the Ambient Sound selector starts the real ambient playback source, loops at ambient volume, pauses for other playback, and resumes automatically after stop.
- Kept other Audio Effects selectors as one-shot previews while saving the selected file first so preview behavior matches the stored configuration.
- Added an embedded favicon served directly by the firmware web UI.

Release assets:

- esp32-notifier-v0.1.16.bin
- esp32-notifier-hacs-v0.1.16.bin
- esp32-notifier-hacs-slim-v0.1.16.bin
- esp32s3-notifier-v0.1.16.bin
- esp32s3-notifier-hacs-v0.1.16.bin
- esp32s3-notifier-hacs-slim-v0.1.16.bin